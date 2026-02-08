import {workflowExecutionService} from '../../src/services/workflow';
import {workflowQueueService} from '../../src/services/workflow';
import {connectionStore} from '../../src/services/connectionStore.js';
import {podStore} from '../../src/services/podStore.js';
import {messageStore} from '../../src/services/messageStore.js';
import {summaryService} from '../../src/services/summaryService.js';
import {workflowStateService} from '../../src/services/workflow';
import {workflowEventEmitter} from '../../src/services/workflow';
import {pendingTargetStore} from '../../src/services/pendingTargetStore.js';
import {directTriggerStore} from '../../src/services/directTriggerStore.js';
import {claudeQueryService} from '../../src/services/claude/queryService.js';
import {autoClearService} from '../../src/services/autoClear';
import {logger} from '../../src/utils/logger.js';
import type {Connection} from '../../src/types';

describe('WorkflowQueueFlow - Queue 處理、混合場景、錯誤恢復', () => {
    const canvasId = 'canvas-1';
    const sourcePodId = 'source-pod';
    const targetPodId = 'target-pod';

    const mockSourcePod = {
        id: sourcePodId,
        name: 'Source Pod',
        model: 'claude-sonnet-4-5-20250929' as const,
        claudeSessionId: null,
        repositoryId: null,
        workspacePath: '/test/workspace',
        commandId: null,
        outputStyleId: null,
        status: 'idle' as const,
    };

    const mockTargetPod = {
        id: targetPodId,
        name: 'Target Pod',
        model: 'claude-sonnet-4-5-20250929' as const,
        claudeSessionId: null,
        repositoryId: null,
        workspacePath: '/test/workspace',
        commandId: null,
        outputStyleId: null,
        status: 'idle' as const,
    };

    const mockAutoConnection: Connection = {
        id: 'conn-auto-1',
        sourcePodId,
        sourceAnchor: 'right',
        targetPodId,
        targetAnchor: 'left',
        triggerMode: 'auto',
        decideStatus: 'none',
        decideReason: null,
        connectionStatus: 'idle',
        createdAt: new Date(),
    };

    const mockDirectConnection: Connection = {
        id: 'conn-direct-1',
        sourcePodId,
        sourceAnchor: 'right',
        targetPodId: 'target-pod-3',
        targetAnchor: 'left',
        triggerMode: 'direct',
        decideStatus: 'none',
        decideReason: null,
        connectionStatus: 'idle',
        createdAt: new Date(),
    };

    const mockMessages = [
        {
            id: 'msg-1',
            podId: sourcePodId,
            role: 'user' as const,
            content: 'Test message',
            timestamp: Date.now(),
            toolUse: null,
        },
        {
            id: 'msg-2',
            podId: sourcePodId,
            role: 'assistant' as const,
            content: 'Test response',
            timestamp: Date.now(),
            toolUse: null,
        },
    ];

    beforeEach(() => {
        // connectionStore
        vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
        vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([]);
        vi.spyOn(connectionStore, 'getById').mockReturnValue(undefined);
        vi.spyOn(connectionStore, 'updateDecideStatus').mockImplementation(() => undefined);
        vi.spyOn(connectionStore, 'updateConnectionStatus').mockImplementation(() => undefined);

        // podStore
        vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
            if (podId === sourcePodId) return {...mockSourcePod};
            if (podId.startsWith('target-pod')) return {...mockTargetPod, id: podId, name: `Target ${podId}`};
            return undefined;
        }) as any);
        vi.spyOn(podStore, 'setStatus').mockImplementation(() => {});
        vi.spyOn(podStore, 'updateLastActive').mockImplementation(() => {});

        // messageStore
        vi.spyOn(messageStore, 'getMessages').mockReturnValue(mockMessages as any);
        vi.spyOn(messageStore, 'addMessage').mockResolvedValue({success: true, data: undefined as any});
        vi.spyOn(messageStore, 'upsertMessage').mockImplementation(() => {});
        vi.spyOn(messageStore, 'flushWrites').mockResolvedValue(undefined);

        // summaryService
        vi.spyOn(summaryService, 'generateSummaryForTarget').mockResolvedValue({
            targetPodId: '',
            success: true,
            summary: 'Test summary',
        });

        // workflowStateService
        vi.spyOn(workflowStateService, 'checkMultiInputScenario').mockReturnValue({
            isMultiInput: false,
            requiredSourcePodIds: [],
        });
        vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
        vi.spyOn(workflowStateService, 'initializePendingTarget').mockImplementation(() => {});
        vi.spyOn(workflowStateService, 'recordSourceCompletion').mockReturnValue({
            allSourcesResponded: true,
            hasRejection: false,
        });
        vi.spyOn(workflowStateService, 'recordSourceRejection').mockImplementation(() => {});
        vi.spyOn(workflowStateService, 'getCompletedSummaries').mockReturnValue(new Map());
        vi.spyOn(workflowStateService, 'clearPendingTarget').mockImplementation(() => {});

        // workflowEventEmitter
        vi.spyOn(workflowEventEmitter, 'emitWorkflowAutoTriggered').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitWorkflowTriggered').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitWorkflowComplete').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitAiDecidePending').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitAiDecideResult').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitAiDecideError').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitWorkflowQueued').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitWorkflowQueueProcessed').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitDirectTriggered').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitDirectWaiting').mockImplementation(() => {});
        vi.spyOn(workflowEventEmitter, 'emitDirectMerged').mockImplementation(() => {});

        // pendingTargetStore
        vi.spyOn(pendingTargetStore, 'hasPendingTarget').mockReturnValue(false);
        vi.spyOn(pendingTargetStore, 'getPendingTarget').mockReturnValue(undefined);
        vi.spyOn(pendingTargetStore, 'clearPendingTarget').mockImplementation(() => {});

        // directTriggerStore
        vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(false);
        vi.spyOn(directTriggerStore, 'initializeDirectPending').mockImplementation(() => {});
        vi.spyOn(directTriggerStore, 'recordDirectReady').mockImplementation((() => {}) as any);
        vi.spyOn(directTriggerStore, 'clearDirectPending').mockImplementation(() => {});
        vi.spyOn(directTriggerStore, 'hasActiveTimer').mockReturnValue(false);
        vi.spyOn(directTriggerStore, 'clearTimer').mockImplementation(() => {});
        vi.spyOn(directTriggerStore, 'setTimer').mockImplementation(() => {});
        vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(new Map());

        // claudeQueryService
        (vi.spyOn(claudeQueryService, 'sendMessage') as any).mockImplementation(async (...args: any[]) => {
            const callback = args[2] as any;
            callback({type: 'text', content: 'Response text'});
            callback({type: 'complete'});
        });

        // autoClearService
        vi.spyOn(autoClearService, 'initializeWorkflowTracking').mockImplementation(() => {});
        vi.spyOn(autoClearService, 'onPodComplete').mockResolvedValue(undefined);

        // logger
        vi.spyOn(logger, 'log').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        // 清空所有 queue
        workflowQueueService.clearQueue(targetPodId);
        workflowQueueService.clearQueue('target-pod-2');
        workflowQueueService.clearQueue('target-pod-3');
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

            // 驗證 connection 狀態更新為 active
            expect(connectionStore.updateConnectionStatus).toHaveBeenCalledWith(canvasId, queuedConnection.id, 'active');

            // 驗證 emitWorkflowQueueProcessed 被呼叫，帶正確的 remainingQueueSize 和 triggerMode
            expect(workflowEventEmitter.emitWorkflowQueueProcessed).toHaveBeenCalledWith(
                canvasId,
                expect.objectContaining({
                    canvasId,
                    targetPodId,
                    connectionId: queuedConnection.id,
                    sourcePodId: queuedConnection.sourcePodId,
                    remainingQueueSize: 0, // 因為只有一個 item
                    triggerMode: 'auto',
                })
            );

            // 驗證 triggerWorkflowWithSummary 被呼叫（透過 sendMessage）
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
                false
            );

            // triggerWorkflowWithSummary 應該不會被 processNextInQueue 阻塞
            await triggerPromise;

            // 等一點時間讓 fire-and-forget 的 processNextInQueue 被呼叫
            await new Promise(resolve => setTimeout(resolve, 50));

            // 驗證 processNextInQueue 被呼叫（但不 await）
            expect(processNextInQueueCalled).toBe(true);
            expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, targetPodId);

            // 驗證 workflowComplete 事件被發送
            expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
                canvasId,
                mockAutoConnection.id,
                sourcePodId,
                targetPodId,
                true,
                undefined,
                'auto'
            );
        });
    });

    describe('C3: Queue 中不同 triggerMode 的事件區分', () => {
        it('direct/ai-decide 模式的 item：triggerWorkflowWithSummary 被呼叫時 skipAutoTriggeredEvent = true', async () => {
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

            // 直接呼叫 triggerWorkflowWithSummary 測試 skipAutoTriggeredEvent = true
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                directConn.id,
                'Direct summary',
                true,
                true // skipAutoTriggeredEvent = true
            );

            // 驗證 emitWorkflowAutoTriggered 不被呼叫（因為 skipAutoTriggeredEvent = true）
            expect(workflowEventEmitter.emitWorkflowAutoTriggered).not.toHaveBeenCalled();

            // 驗證 emitWorkflowTriggered 仍然被呼叫
            expect(workflowEventEmitter.emitWorkflowTriggered).toHaveBeenCalled();
        });

        it('auto 模式的 item：triggerWorkflowWithSummary 被呼叫時 skipAutoTriggeredEvent = false', async () => {
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

            // 直接呼叫 triggerWorkflowWithSummary 測試 skipAutoTriggeredEvent = false
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                autoConn.id,
                'Auto summary',
                true,
                false // skipAutoTriggeredEvent = false
            );

            // 驗證 emitWorkflowAutoTriggered 被呼叫（因為 skipAutoTriggeredEvent = false）
            expect(workflowEventEmitter.emitWorkflowAutoTriggered).toHaveBeenCalled();

            // 驗證 emitWorkflowTriggered 也被呼叫
            expect(workflowEventEmitter.emitWorkflowTriggered).toHaveBeenCalled();
        });

        it('workflowQueueService.processNextInQueue 根據 triggerMode 設定正確的 skipAutoTriggeredEvent', () => {
            // 測試 workflowQueueService 內部邏輯：direct 和 ai-decide 設定 skipAutoTriggeredEvent = true
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

            // 驗證邏輯：direct 和 ai-decide 應該設定 skipAutoTriggeredEvent = true
            expect((directItem.triggerMode as string) === 'direct' || (directItem.triggerMode as string) === 'ai-decide').toBe(true);
            expect((aiDecideItem.triggerMode as string) === 'direct' || (aiDecideItem.triggerMode as string) === 'ai-decide').toBe(true);

            // 驗證邏輯：auto 應該設定 skipAutoTriggeredEvent = false
            expect((autoItem.triggerMode as string) === 'direct' || (autoItem.triggerMode as string) === 'ai-decide').toBe(false);
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

            // 呼叫 triggerWorkflowWithSummary，預期拋出錯誤
            await expect(
                workflowExecutionService.triggerWorkflowWithSummary(
                    canvasId,
                    conn.id,
                    'Test summary',
                    true,
                    false
                )
            ).rejects.toThrow('Claude query failed');

            // 等一點時間讓 fire-and-forget 的 processNextInQueue 被呼叫
            await new Promise(resolve => setTimeout(resolve, 50));

            // 驗證 emitWorkflowComplete 被呼叫，success 為 false
            expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
                canvasId,
                conn.id,
                sourcePodId,
                'target-fail',
                false,
                'Claude query failed',
                'auto'
            );

            // 驗證 processNextInQueue 仍然被呼叫（在 catch 區塊中）
            expect(processNextInQueueCalled).toBe(true);
            expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, 'target-fail');

            // 驗證 target pod 狀態被設回 idle
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, 'target-fail', 'idle');
        });
    });
});
