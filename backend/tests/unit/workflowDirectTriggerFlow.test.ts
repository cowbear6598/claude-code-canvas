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
        mockMessages = createMockMessages();

        const summary = { targetPodId: '', success: true, summary: testSummary };
        const customClaudeQuery = async (...args: any[]) => {
            const callback = args[2] as any;
            callback({ type: 'text', content: 'Claude response' });
            callback({ type: 'complete' });
        };
        const customPodGetter = (_cId: string, podId: string) => {
            if (podId === sourcePodId) return { ...mockSourcePod };
            if (podId.startsWith('source-pod')) return createMockPod({ id: podId, name: `Source ${podId}`, status: 'idle' });
            if (podId === targetPodId) return { ...mockTargetPod };
            if (podId.startsWith('target-pod')) return createMockPod({ id: podId, name: `Target ${podId}`, status: 'idle' });
            return undefined;
        };

        setupAllSpies({ customPodGetter, messages: mockMessages, connection: mockDirectConnection, directConnectionCount: 1, summary, customClaudeQuery });
    });

    afterEach(() => {
        (workflowDirectTriggerService as any).pendingResolvers.clear();
        vi.restoreAllMocks();
    });

    describe('A1: 單一 direct - target idle → 直接執行', () => {
        it('Target Pod 只有 1 條 direct 連線，target 狀態為 idle，應直接執行', async () => {
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            const triggerSpy = vi.spyOn(workflowExecutionService, 'triggerWorkflowWithSummary').mockResolvedValue(undefined);

            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

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

            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

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

            expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('B1: Multi-direct - 第一個 source 到達 → 初始化等待', () => {
        it('Target Pod 有 2+ 條 direct 連線，第一個 source 完成，應初始化等待並設定 timer', async () => {
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
            vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(false);

            // fake timers 避免真實延遲
            vi.useFakeTimers();

            // 不 await：會在等待其他 source 時卡住
            workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

            // 讓微任務執行完畢
            await Promise.resolve();
            await Promise.resolve();

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

            expect(directTriggerStore.setTimer).toHaveBeenCalled();

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

            let firstResolver: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                firstResolver = result;
            });

            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([connection2]);
            vi.spyOn(connectionStore, 'getById').mockReturnValue(connection2);
            vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
            vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(true);
            vi.spyOn(directTriggerStore, 'hasActiveTimer').mockReturnValue(true);

            // fake timers 避免真實延遲
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => 123 as any);

            // 第二個 source collectSources 回傳 ready:false，立即完成
            await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source2PodId);

            expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, source2PodId, testSummary);
            expect(directTriggerStore.clearTimer).toHaveBeenCalledWith(targetPodId);
            expect(setTimeoutSpy).toHaveBeenCalled();
            expect(directTriggerStore.setTimer).toHaveBeenCalled();
            expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledTimes(1);
        });
    });

    describe('B3: Timer 到期 - 單源, target idle → 執行', () => {
        it('只有 1 個 source ready，timer 到期，target idle，應執行工作流', async () => {
            const readySummaries = new Map([[sourcePodId, testSummary]]);
            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            // 透過反射測試私有方法 onTimerExpired
            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            // onTimerExpired 不再發送 DIRECT_TRIGGERED 事件，這個事件會在 trigger 階段發送
            expect(resolvedResult).toEqual({ready: true});

            expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);

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

            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId || podId === source2PodId) return {...mockSourcePod, id: podId};
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return undefined;
            }) as any);

            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalledWith(
                canvasId,
                expect.objectContaining({
                    canvasId,
                    targetPodId,
                    sourcePodIds: [sourcePodId, source2PodId],
                    countdownSeconds: 0,
                })
            );

            expect(resolvedResult).toEqual({
                ready: true,
                mergedContent: expect.any(String),
                isSummarized: true,
            });

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

            vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
            vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === sourcePodId || podId === source2PodId) return {...mockSourcePod, id: podId};
                if (podId === targetPodId) return {...mockTargetPod, status: 'chatting'};
                return undefined;
            }) as any);

            let resolvedResult: any;
            (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
                resolvedResult = result;
            });

            (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

            expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalled();

            expect(resolvedResult).toEqual({
                ready: true,
                mergedContent: expect.any(String),
                isSummarized: true,
            });

            expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);

            // onTimerExpired 不再發送 DIRECT_TRIGGERED 和 WORKFLOW_COMPLETE 事件
            // 這些事件會在 trigger 階段（triggerWorkflowWithSummary）和 executeClaudeQuery 完成後發送
            expect(workflowEventEmitter.emitDirectTriggered).not.toHaveBeenCalled();
            expect(workflowEventEmitter.emitWorkflowComplete).not.toHaveBeenCalled();
        });
    });
});
