import { workflowExecutionService } from '../../src/services/workflow';
import { workflowDirectTriggerService } from '../../src/services/workflow/workflowDirectTriggerService.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { directTriggerStore } from '../../src/services/directTriggerStore.js';
import { workflowStateService } from '../../src/services/workflow';
import { workflowEventEmitter } from '../../src/services/workflow';
import { workflowQueueService } from '../../src/services/workflow';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import { summaryService } from '../../src/services/summaryService.js';
import { setupAllSpies } from '../mocks/workflowSpySetup.js';
import { createMockPod, createMockConnection, createMockMessages } from '../mocks/workflowTestFactories.js';
import type { Connection } from '../../src/types';

describe('Direct Trigger Flow', () => {
    const canvasId = 'canvas-1';
    const sourcePodId = 'source-pod';
    const targetPodId = 'target-pod';
    const connectionId = 'conn-direct-1';
    const testSummary = 'Test summary content';

    let mockSourcePod: ReturnType<typeof createMockPod>;
    let mockTargetPod: ReturnType<typeof createMockPod>;
    let mockDirectConnection: Connection;
    let mockMessages: ReturnType<typeof createMockMessages>;

    beforeEach(() => {
        mockSourcePod = createMockPod({ id: sourcePodId, name: 'Source Pod', status: 'idle' });
        mockTargetPod = createMockPod({ id: targetPodId, name: 'Target Pod', status: 'idle' });
        mockDirectConnection = createMockConnection({ id: connectionId, sourcePodId, targetPodId, triggerMode: 'direct' });
        mockMessages = createMockMessages(sourcePodId);

        const podLookup = new Map([[sourcePodId, mockSourcePod], [targetPodId, mockTargetPod]]);
        const summary = { targetPodId: '', success: true, summary: testSummary };
        const customClaudeQuery = async (...args: any[]) => {
            const callback = args[2] as any;
            callback({ type: 'text', content: 'Claude response' });
            callback({ type: 'complete' });
        };

        setupAllSpies({ podLookup, messages: mockMessages, connection: mockDirectConnection, directConnectionCount: 1, summary, customClaudeQuery });
    });

    afterEach(() => {
        // 清理 pendingResolvers
        (workflowDirectTriggerService as any).pendingResolvers.clear();
        vi.restoreAllMocks();
    });

    describe('A1: 單一 direct - target idle → 直接執行', () => {
        it('Target Pod 只有 1 條 direct 連線，target 狀態為 idle，應直接執行', async () => {
            // 準備
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            // Mock triggerWorkflowWithSummary 避免執行完整工作流
            const triggerSpy = vi.spyOn(workflowExecutionService, 'triggerWorkflowWithSummary').mockResolvedValue(undefined);

            // 執行
            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

            // 驗證：triggerWorkflowWithSummary 被呼叫，strategy 會在 triggerWorkflowWithSummary 中處理 DIRECT_TRIGGERED 事件
            expect(triggerSpy).toHaveBeenCalled();
            const call = triggerSpy.mock.calls[0];
            expect(call[0]).toBe(canvasId);
            expect(call[1]).toBe(mockDirectConnection.id);
            expect(call[2]).toBe(testSummary);
            expect(call[3]).toBe(true);
            expect(call[4]).toHaveProperty('mode', 'direct');
        });
    });

    describe('A2: 單一 direct - target busy → 進 queue', () => {
        it('Target Pod 只有 1 條 direct 連線，target 狀態為 chatting，應進入 queue', async () => {
            // 準備
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId === targetPodId) return {...mockTargetPod, status: 'chatting'};
                return undefined;
            }) as any);

            const enqueueSpy = vi.spyOn(workflowQueueService, 'enqueue').mockImplementation(() => ({
                position: 1,
                queueSize: 1
            }));

            // 執行
            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

            // 驗證
            expect(enqueueSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    canvasId,
                    connectionId: mockDirectConnection.id,
                    sourcePodId,
                    targetPodId,
                    summary: testSummary,
                    isSummarized: true,
                    triggerMode: 'direct',
                })
            );

            // 驗證 triggerWorkflowWithSummary 不被呼叫
            expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('B1: Multi-direct - 第一個 source 到達 → 初始化等待', () => {
        it('Target Pod 有 2+ 條 direct 連線，第一個 source 完成，應初始化等待並設定 timer', async () => {
            // 準備
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
            vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(false); // 第一次，pending 不存在

            // 使用 fake timers 來控制 setTimeout
            vi.useFakeTimers();

            // 執行（不 await，因為會卡在 Promise）
            workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

            // 使用 vi.runAllTimersAsync 讓所有同步代碼執行完畢（但不執行 setTimeout callback）
            // 實際上我們只需要等待微任務執行
            await Promise.resolve();
            await Promise.resolve();

            // 驗證（此時已經執行到設定 timer 的步驟）
            expect(directTriggerStore.initializeDirectPending).toHaveBeenCalledWith(targetPodId);
            expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, sourcePodId, testSummary);
            expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledWith(
                canvasId,
                expect.objectContaining({
                    canvasId,
                    connectionId: mockDirectConnection.id,
                    sourcePodId,
                    targetPodId,
                })
            );

            // 驗證 directTriggerStore.setTimer 被呼叫
            expect(directTriggerStore.setTimer).toHaveBeenCalled();

            // 清理
            vi.useRealTimers();
        });
    });

    describe('B2: Multi-direct - 第二個 source 到達 → timer 重設', () => {
        it('Target Pod 有 2+ 條 direct 連線，已有一個 source 在 waiting，應重設 timer', async () => {
            const source2PodId = 'source-pod-2';
            const connection2: Connection = {
                ...mockDirectConnection,
                id: 'conn-direct-2',
                sourcePodId: source2PodId,
            };

            // 準備：先設定第一個 source 的 resolver（模擬已有 pending 狀態）
            let firstResolver: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                firstResolver = result;
            });

            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([connection2]);
            vi.spyOn(connectionStore, 'getById').mockReturnValue(connection2);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
            vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(true); // pending 已存在
            vi.spyOn(directTriggerStore, 'hasActiveTimer').mockReturnValue(true); // 有舊 timer

            // Mock setTimeout 讓它不要真的執行
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => 123 as any);

            // 執行（第二個 source 會回傳 { ready: false }，所以會立即完成）
            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source2PodId);

            // 驗證
            expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, source2PodId, testSummary);
            expect(directTriggerStore.clearTimer).toHaveBeenCalledWith(targetPodId); // 舊 timer 被清除
            expect(setTimeoutSpy).toHaveBeenCalled(); // 新 timer 被設定
            expect(directTriggerStore.setTimer).toHaveBeenCalled();
            expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledTimes(1); // 發送 waiting 事件
        });
    });

    describe('B3: Timer 到期 - 單源, target idle → 執行', () => {
        it('只有 1 個 source ready，timer 到期，target idle，應執行工作流', async () => {
            // 準備 - 模擬 timer 到期時的狀態
            const readySummaries = new Map([[sourcePodId, testSummary]]);
            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            // 手動設定 pendingResolvers
            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            // 直接呼叫 onTimerExpired（透過反射訪問私有方法）
            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            // 驗證 resolver 被呼叫且回傳 ready: true
            // onTimerExpired 不再發送 DIRECT_TRIGGERED 事件，這個事件會在 trigger 階段發送
            expect(resolvedResult).toEqual({ready: true});

            // 驗證 clearDirectPending 被呼叫
            expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);

            // 驗證 emitDirectTriggered 不在 onTimerExpired 中被呼叫
            expect(workflowEventEmitter.emitDirectTriggered).not.toHaveBeenCalled();
        });
    });

    describe('B4: Timer 到期 - 多源合併, target idle → 合併執行 + 其他連線立即 complete', () => {
        it('2 個 source ready，timer 到期，target idle，應合併執行並為其他連線發送 complete', async () => {
            const source2PodId = 'source-pod-2';
            const connection2: Connection = {
                ...mockDirectConnection,
                id: 'conn-direct-2',
                sourcePodId: source2PodId,
            };

            const summary2 = 'Test summary 2';
            const readySummaries = new Map([
                [sourcePodId, testSummary],
                [source2PodId, summary2],
            ]);

            // 準備
            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId || podId === source2PodId) return {...mockSourcePod, id: podId};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            // 手動設定 pendingResolvers
            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            // 執行
            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            // 驗證
            expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalledWith(
                canvasId,
                expect.objectContaining({
                    canvasId,
                    targetPodId,
                    sourcePodIds: [sourcePodId, source2PodId],
                    countdownSeconds: 0,
                })
            );

            // 驗證 resolver 被呼叫且回傳 ready: true 和 mergedContent
            expect(resolvedResult).toEqual({
                ready: true,
                mergedContent: expect.any(String),
                isSummarized: true,
            });

            // 驗證 clearDirectPending 被呼叫
            expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);

            // onTimerExpired 不再發送 DIRECT_TRIGGERED 和 WORKFLOW_COMPLETE 事件
            // 這些事件會在 trigger 階段（triggerWorkflowWithSummary）和 executeClaudeQuery 完成後發送
            expect(workflowEventEmitter.emitDirectTriggered).not.toHaveBeenCalled();
            expect(workflowEventEmitter.emitWorkflowComplete).not.toHaveBeenCalled();
        });
    });

    describe('B5: Timer 到期 - 多源合併 → 回傳 ready: true（Pipeline 後續會處理 enqueue）', () => {
        it('2 個 source ready，timer 到期，onTimerExpired 應回傳 ready: true 和合併內容', async () => {
            const source2PodId = 'source-pod-2';
            const connection2: Connection = {
                ...mockDirectConnection,
                id: 'conn-direct-2',
                sourcePodId: source2PodId,
            };

            const summary2 = 'Test summary 2';
            const readySummaries = new Map([
                [sourcePodId, testSummary],
                [source2PodId, summary2],
            ]);

            // 準備
            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId || podId === source2PodId) return {...mockSourcePod, id: podId};
                if (podId === targetPodId) return {...mockTargetPod, status: 'chatting'}; // target busy
                return undefined;
            }) as any);

            // 手動設定 pendingResolvers
            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            // 執行
            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            // 驗證
            expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalled();

            // 驗證 resolver 被呼叫且回傳 ready: true 和 mergedContent
            // Pipeline 的後續 checkQueue 階段會根據 target Pod 狀態決定是否 enqueue
            expect(resolvedResult).toEqual({
                ready: true,
                mergedContent: expect.any(String),
                isSummarized: true,
            });

            // 驗證 clearDirectPending 被呼叫
            expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);

            // onTimerExpired 不再發送 DIRECT_TRIGGERED 和 WORKFLOW_COMPLETE 事件
            // 這些事件會在 trigger 階段（triggerWorkflowWithSummary）和 executeClaudeQuery 完成後發送
            expect(workflowEventEmitter.emitDirectTriggered).not.toHaveBeenCalled();
            expect(workflowEventEmitter.emitWorkflowComplete).not.toHaveBeenCalled();
        });
    });
});
