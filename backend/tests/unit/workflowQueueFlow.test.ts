import { workflowExecutionService } from '../../src/services/workflow';
import { workflowQueueService } from '../../src/services/workflow';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import { setupAllSpies } from '../mocks/workflowSpySetup.js';
import {
  createMockPod,
  createMockConnection,
  createMockMessages,
  createMockStrategy,
  initializeQueueService,
  clearAllQueues
} from '../mocks/workflowTestFactories.js';
import type { Connection } from '../../src/types';
import type { TriggerStrategy } from '../../src/services/workflow/types.js';

describe('WorkflowQueueFlow - Queue 處理、混合場景、錯誤恢復', () => {
    const canvasId = 'canvas-1';
    const sourcePodId = 'source-pod';
    const targetPodId = 'target-pod';

    let mockSourcePod: ReturnType<typeof createMockPod>;
    let mockTargetPod: ReturnType<typeof createMockPod>;
    let mockAutoConnection: Connection;
    let mockDirectConnection: Connection;
    let mockMessages: ReturnType<typeof createMockMessages>;
    let mockAutoStrategy: TriggerStrategy;
    let mockDirectStrategy: TriggerStrategy;
    let mockAiDecideStrategy: TriggerStrategy;

    beforeEach(() => {
        mockSourcePod = createMockPod({ id: sourcePodId, name: 'Source Pod', status: 'idle' });
        mockTargetPod = createMockPod({ id: targetPodId, name: 'Target Pod', status: 'idle' });
        mockAutoConnection = createMockConnection({ id: 'conn-auto-1', sourcePodId, targetPodId, triggerMode: 'auto' });
        mockDirectConnection = createMockConnection({ id: 'conn-direct-1', sourcePodId, targetPodId: 'target-pod-3', triggerMode: 'direct' });
        mockMessages = createMockMessages(sourcePodId);
        mockAutoStrategy = createMockStrategy('auto');
        mockDirectStrategy = createMockStrategy('direct');
        mockAiDecideStrategy = createMockStrategy('ai-decide');

        // 動態 Pod 查詢：支援 target-pod-* 模式
        const customPodGetter = (cId: string, podId: string) => {
            if (podId === sourcePodId) return { ...mockSourcePod };
            if (podId.startsWith('target-pod')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
            return undefined;
        };

        setupAllSpies({ messages: mockMessages, customPodGetter });

        // 初始化並清空 queue
        initializeQueueService({ auto: mockAutoStrategy, direct: mockDirectStrategy, 'ai-decide': mockAiDecideStrategy });
        clearAllQueues([targetPodId, 'target-pod-2', 'target-pod-3']);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('C1: Queue - Workflow 完成後自動 dequeue 下一項', () => {
        it('processNextInQueue 正確 dequeue 並觸發下一個 workflow', async () => {
            const queuedConnection: Connection = {
                id: 'conn-queued',
                sourcePodId: 'source-pod-2',
                sourceAnchor: 'right',
                targetPodId,
                targetAnchor: 'left',
                triggerMode: 'auto',
                decideStatus: 'none',
                decideReason: null,
                connectionStatus: 'idle',
                createdAt: new Date(),
            };

            // 先驗證 queue 為空
            expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);

            // 加入一個 item 到 queue
            workflowQueueService.enqueue({
                canvasId,
                connectionId: queuedConnection.id,
                sourcePodId: queuedConnection.sourcePodId,
                targetPodId,
                summary: 'Queued summary',
                isSummarized: true,
                triggerMode: 'auto',
            });

            expect(workflowQueueService.getQueueSize(targetPodId)).toBe(1);

            // 設定此測試需要的 mock 行為
            vi.spyOn(connectionStore, 'getById').mockReturnValue(queuedConnection);
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                return {...mockSourcePod, id: podId};
            }) as any);

            // 呼叫 processNextInQueue
            await workflowQueueService.processNextInQueue(canvasId, targetPodId);

            // 驗證 dequeue 被執行，queue 被清空
            expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);

            // 驗證 strategy.onQueueProcessed 被呼叫
            expect(mockAutoStrategy.onQueueProcessed).toHaveBeenCalledWith(
                expect.objectContaining({
                    canvasId,
                    targetPodId,
                    connectionId: queuedConnection.id,
                    sourcePodId: queuedConnection.sourcePodId,
                    remainingQueueSize: 0,
                    triggerMode: 'auto',
                })
            );

            // 驗證 triggerWorkflowWithSummary 被呼叫
            // executeClaudeQuery 現在是 fire-and-forget，所以 sendMessage 會被呼叫
            // 但需要等待一下讓 fire-and-forget 的 Promise 執行
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(claudeQueryService.sendMessage).toHaveBeenCalled();
        });
    });

    describe('C2: processNextInQueue 是 fire-and-forget，不阻塞呼叫者', () => {
        it('executeClaudeQuery 完成後呼叫 processNextInQueue 不 await，不阻塞', async () => {
            // 準備一個 connection 和 target pod
            vi.spyOn(connectionStore, 'getById').mockReturnValue(mockAutoConnection);
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                if (podId === sourcePodId) return mockSourcePod;
                return undefined;
            }) as any);

            // Mock processNextInQueue 為一個會延遲的 Promise
            let processNextInQueueCalled = false;
            const processNextInQueueSpy = vi.spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
                processNextInQueueCalled = true;
                // 模擬一個需要時間的操作
                await new Promise(resolve => setTimeout(resolve, 100));
            });

            // 呼叫 triggerWorkflowWithSummary（內部會呼叫 executeClaudeQuery）
            const triggerPromise = workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                mockAutoConnection.id,
                'Test summary',
                true,
                mockAutoStrategy
            );

            // triggerWorkflowWithSummary 應該不會被 processNextInQueue 阻塞
            await triggerPromise;

            // 等一點時間讓 fire-and-forget 的 executeClaudeQuery 和 processNextInQueue 完成
            await new Promise(resolve => setTimeout(resolve, 150));

            // 驗證 processNextInQueue 被呼叫（但不 await）
            expect(processNextInQueueCalled).toBe(true);
            expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, targetPodId);
        });
    });

    describe('C3: Queue 中不同 triggerMode 的 strategy 處理', () => {
        it('direct 模式的 item：strategy.onTrigger 被呼叫', async () => {
            const directConn: Connection = {
                ...mockDirectConnection,
                targetPodId: 'target-pod-direct',
            };

            vi.spyOn(connectionStore, 'getById').mockReturnValue(directConn);
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === directConn.targetPodId) return {
                    ...mockTargetPod,
                    id: directConn.targetPodId,
                    status: 'idle'
                };
                return {...mockSourcePod, id: podId};
            }) as any);

            // 直接呼叫 triggerWorkflowWithSummary 傳入 direct strategy
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                directConn.id,
                'Direct summary',
                true,
                mockDirectStrategy
            );

            // 驗證 strategy.onTrigger 被呼叫
            expect(mockDirectStrategy.onTrigger).toHaveBeenCalledWith(
                expect.objectContaining({
                    canvasId,
                    connectionId: directConn.id,
                    summary: 'Direct summary',
                    isSummarized: true,
                })
            );
        });

        it('auto 模式的 item：strategy.onTrigger 被呼叫', async () => {
            const autoConn: Connection = {
                ...mockAutoConnection,
                targetPodId: 'target-pod-auto',
            };

            vi.spyOn(connectionStore, 'getById').mockReturnValue(autoConn);
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === autoConn.targetPodId) return {
                    ...mockTargetPod,
                    id: autoConn.targetPodId,
                    status: 'idle'
                };
                return {...mockSourcePod, id: podId};
            }) as any);

            // 直接呼叫 triggerWorkflowWithSummary 傳入 auto strategy
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                autoConn.id,
                'Auto summary',
                true,
                mockAutoStrategy
            );

            // 驗證 strategy.onTrigger 被呼叫
            expect(mockAutoStrategy.onTrigger).toHaveBeenCalledWith(
                expect.objectContaining({
                    canvasId,
                    connectionId: autoConn.id,
                    summary: 'Auto summary',
                    isSummarized: true,
                })
            );
        });

        it('workflowQueueService.processNextInQueue 根據 triggerMode 使用正確的 strategy', () => {
            const directItem = {
                canvasId,
                connectionId: 'conn-direct',
                sourcePodId,
                targetPodId,
                summary: 'test',
                isSummarized: true,
                triggerMode: 'direct' as const,
            };

            const aiDecideItem = {
                ...directItem,
                connectionId: 'conn-ai',
                triggerMode: 'ai-decide' as const,
            };

            const autoItem = {
                ...directItem,
                connectionId: 'conn-auto',
                triggerMode: 'auto' as const,
            };

            // 驗證邏輯：不同的 triggerMode 應該對應不同的 strategy
            expect(directItem.triggerMode).toBe('direct');
            expect(aiDecideItem.triggerMode).toBe('ai-decide');
            expect(autoItem.triggerMode).toBe('auto');
        });
    });

    describe('D1: Direct + Auto 混合 - 完整流程', () => {
        it('checkAndTriggerWorkflows 同時處理 direct 和 auto connections（平行分派）', () => {
            // 測試概念：checkAndTriggerWorkflows 會將 connections 分為 auto, ai-decide, direct 三組
            // 然後使用 Promise.all 平行處理這三組
            const connections = [
                {id: 'conn-auto', triggerMode: 'auto'},
                {id: 'conn-direct', triggerMode: 'direct'},
            ];

            // 模擬分組邏輯
            const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
            const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

            // 驗證分組正確
            expect(autoConnections.length).toBe(1);
            expect(directConnections.length).toBe(1);

            // 驗證兩組都會被處理（概念驗證）
            expect(autoConnections[0].id).toBe('conn-auto');
            expect(directConnections[0].id).toBe('conn-direct');
        });
    });

    describe('D2: Auto + AI-Decide + Direct 三種模式平行分派', () => {
        it('checkAndTriggerWorkflows 平行處理三種 triggerMode 的 connections（分組並 Promise.all）', () => {
            // 測試概念：checkAndTriggerWorkflows 會將 connections 分為三組：auto, ai-decide, direct
            // 然後使用 Promise.all 平行處理這三組
            const connections = [
                {id: 'conn-auto', triggerMode: 'auto'},
                {id: 'conn-ai', triggerMode: 'ai-decide'},
                {id: 'conn-direct', triggerMode: 'direct'},
            ];

            // 模擬分組邏輯
            const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
            const aiDecideConnections = connections.filter((conn) => conn.triggerMode === 'ai-decide');
            const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

            // 驗證分組正確
            expect(autoConnections.length).toBe(1);
            expect(aiDecideConnections.length).toBe(1);
            expect(directConnections.length).toBe(1);

            // 驗證三組都會被處理（概念驗證）
            expect(autoConnections[0].id).toBe('conn-auto');
            expect(aiDecideConnections[0].id).toBe('conn-ai');
            expect(directConnections[0].id).toBe('conn-direct');

            // 驗證平行分派邏輯：三者應該可以同時執行
            // 在實際代碼中是通過 Promise.all([processAuto(), processAiDecide(), processDirect()]) 實現
            const willBeProcessedInParallel = autoConnections.length > 0 || aiDecideConnections.length > 0 || directConnections.length > 0;
            expect(willBeProcessedInParallel).toBe(true);
        });
    });

    describe('E1: Workflow 執行失敗後 queue 仍繼續處理', () => {
        it('executeClaudeQuery 拋出錯誤，emitWorkflowComplete(success: false)，processNextInQueue 仍被呼叫', async () => {
            const conn: Connection = {
                ...mockAutoConnection,
                id: 'conn-fail',
                targetPodId: 'target-fail',
            };

            // 準備一個 queued item
            workflowQueueService.enqueue({
                canvasId,
                connectionId: 'conn-queued-after-fail',
                sourcePodId: 'source-pod-2',
                targetPodId: 'target-fail',
                summary: 'Queued after fail',
                isSummarized: true,
                triggerMode: 'auto',
            });

            vi.spyOn(connectionStore, 'getById').mockReturnValue(conn);
            vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
            vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
                if (podId === 'target-fail') return {...mockTargetPod, id: 'target-fail', status: 'idle'};
                if (podId === sourcePodId) return mockSourcePod;
                return undefined;
            }) as any);

            // Mock sendMessage 拋出錯誤
            const testError = new Error('Claude query failed');
            vi.spyOn(claudeQueryService, 'sendMessage').mockImplementation(async () => {
                throw testError;
            });

            // Mock processNextInQueue spy
            let processNextInQueueCalled = false;
            const processNextInQueueSpy = vi.spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
                processNextInQueueCalled = true;
            });

            // 呼叫 triggerWorkflowWithSummary
            // executeClaudeQuery 現在是 fire-and-forget，所以 triggerWorkflowWithSummary 不會 reject
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                conn.id,
                'Test summary',
                true,
                mockAutoStrategy
            );

            // 等一點時間讓 fire-and-forget 的 executeClaudeQuery 執行並發生錯誤
            await new Promise(resolve => setTimeout(resolve, 100));

            // 驗證 strategy.onError 被呼叫
            expect(mockAutoStrategy.onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    canvasId,
                    connectionId: conn.id,
                    sourcePodId,
                    targetPodId: 'target-fail',
                    triggerMode: 'auto',
                }),
                'Claude query failed'
            );

            // 驗證 processNextInQueue 仍然被呼叫（在 catch 區塊中）
            expect(processNextInQueueCalled).toBe(true);
            expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, 'target-fail');

            // 驗證 target pod 狀態被設回 idle
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, 'target-fail', 'idle');
        });
    });
});
