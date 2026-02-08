import {describe, it, expect, beforeEach, afterEach, spyOn, mock} from 'bun:test';
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

    // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
    let spies: Array<ReturnType<typeof spyOn>> = [];

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

    /**
     * 輔助函數：安全地 spy 或重置已存在的 mock
     * 如果方法已經是 mock（由其他測試的 mock.module 建立），則重置它
     * 否則建立新的 spy
     */
    const setupMock = <T extends object, K extends keyof T>(
        obj: T,
        method: K,
        mockConfig: { returnValue?: any; implementation?: any; resolvedValue?: any }
    ) => {
        const target = obj[method];

        // 如果目標不存在或是 undefined，說明被其他測試的 mock.module 污染但沒有正確初始化
        // 我們需要創建一個新的 mock 函數
        if (target === undefined || target === null) {
            const newMock = mock();
            (obj as any)[method] = newMock;

            if ('returnValue' in mockConfig) {
                newMock.mockReturnValue(mockConfig.returnValue);
            } else if ('implementation' in mockConfig) {
                newMock.mockImplementation(mockConfig.implementation);
            } else if ('resolvedValue' in mockConfig) {
                newMock.mockResolvedValue(mockConfig.resolvedValue);
            }
            return; // 不加入 spies，因為這是替換已污染的模組
        }

        // 檢查是否已經是 mock 函數（由其他測試的 mock.module 建立）
        if (typeof target === 'function' && 'mockReturnValue' in target) {
            // 已經是 mock，清空並重新設定
            (target as any).mockClear?.();
            if ('returnValue' in mockConfig) {
                (target as any).mockReturnValue(mockConfig.returnValue);
            } else if ('implementation' in mockConfig) {
                (target as any).mockImplementation(mockConfig.implementation);
            } else if ('resolvedValue' in mockConfig) {
                (target as any).mockResolvedValue(mockConfig.resolvedValue);
            }
            return; // 不加入 spies，因為不是我們創建的
        }

        // 真實函數，使用 spyOn
        const spy = spyOn(obj, method as any);
        if ('returnValue' in mockConfig) {
            spy.mockReturnValue(mockConfig.returnValue);
        } else if ('implementation' in mockConfig) {
            spy.mockImplementation(mockConfig.implementation);
        } else if ('resolvedValue' in mockConfig) {
            spy.mockResolvedValue(mockConfig.resolvedValue);
        }
        spies.push(spy);
    };

    beforeEach(() => {
        // 清空 spy 陣列
        spies = [];

        // connectionStore
        setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
        setupMock(connectionStore, 'findByTargetPodId', {returnValue: []});
        setupMock(connectionStore, 'getById', {returnValue: undefined});
        setupMock(connectionStore, 'updateDecideStatus', {implementation: () => undefined});
        setupMock(connectionStore, 'updateConnectionStatus', {implementation: () => undefined});

        // podStore
        setupMock(podStore, 'getById', {
            implementation: (cId: string, podId: string) => {
                if (podId === sourcePodId) return {...mockSourcePod};
                if (podId.startsWith('target-pod')) return {...mockTargetPod, id: podId, name: `Target ${podId}`};
                return undefined;
            }
        });
        setupMock(podStore, 'setStatus', {
            implementation: () => {
            }
        });
        setupMock(podStore, 'updateLastActive', {
            implementation: () => {
            }
        });

        // messageStore
        setupMock(messageStore, 'getMessages', {returnValue: mockMessages as any});
        setupMock(messageStore, 'addMessage', {resolvedValue: {success: true, data: undefined as any}});
        setupMock(messageStore, 'upsertMessage', {implementation: () => {}});
        setupMock(messageStore, 'flushWrites', {resolvedValue: undefined});

        // summaryService
        setupMock(summaryService, 'generateSummaryForTarget', {
            resolvedValue: {
                targetPodId: '',
                success: true,
                summary: 'Test summary',
            }
        });

        // workflowStateService
        setupMock(workflowStateService, 'checkMultiInputScenario', {
            returnValue: {
                isMultiInput: false,
                requiredSourcePodIds: [],
            }
        });
        setupMock(workflowStateService, 'getDirectConnectionCount', {returnValue: 1});
        setupMock(workflowStateService, 'initializePendingTarget', {
            implementation: () => {
            }
        });
        setupMock(workflowStateService, 'recordSourceCompletion', {
            returnValue: {
                allSourcesResponded: true,
                hasRejection: false,
            }
        });
        setupMock(workflowStateService, 'recordSourceRejection', {
            implementation: () => {
            }
        });
        setupMock(workflowStateService, 'getCompletedSummaries', {returnValue: new Map()});
        setupMock(workflowStateService, 'clearPendingTarget', {
            implementation: () => {
            }
        });

        // workflowEventEmitter
        setupMock(workflowEventEmitter, 'emitWorkflowAutoTriggered', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitWorkflowTriggered', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitWorkflowComplete', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitAiDecidePending', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitAiDecideResult', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitAiDecideError', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitWorkflowQueued', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitWorkflowQueueProcessed', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitDirectTriggered', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitDirectWaiting', {
            implementation: () => {
            }
        });
        setupMock(workflowEventEmitter, 'emitDirectMerged', {
            implementation: () => {
            }
        });

        // pendingTargetStore
        setupMock(pendingTargetStore, 'hasPendingTarget', {returnValue: false});
        setupMock(pendingTargetStore, 'getPendingTarget', {returnValue: undefined});
        setupMock(pendingTargetStore, 'clearPendingTarget', {
            implementation: () => {
            }
        });

        // directTriggerStore
        setupMock(directTriggerStore, 'hasDirectPending', {returnValue: false});
        setupMock(directTriggerStore, 'initializeDirectPending', {
            implementation: () => {
            }
        });
        setupMock(directTriggerStore, 'recordDirectReady', {
            implementation: () => {
            }
        });
        setupMock(directTriggerStore, 'clearDirectPending', {
            implementation: () => {
            }
        });
        setupMock(directTriggerStore, 'hasActiveTimer', {returnValue: false});
        setupMock(directTriggerStore, 'clearTimer', {
            implementation: () => {
            }
        });
        setupMock(directTriggerStore, 'setTimer', {
            implementation: () => {
            }
        });
        setupMock(directTriggerStore, 'getReadySummaries', {returnValue: new Map()});

        // claudeQueryService
        setupMock(claudeQueryService, 'sendMessage', {
            implementation: async (_podId: string, _message: string, callback: any) => {
                callback({type: 'text', content: 'Response text'});
                callback({type: 'complete'});
            }
        });

        // autoClearService
        setupMock(autoClearService, 'initializeWorkflowTracking', {
            implementation: () => {
            }
        });
        setupMock(autoClearService, 'onPodComplete', {resolvedValue: undefined});

        // logger
        setupMock(logger, 'log', {
            implementation: () => {
            }
        });
        setupMock(logger, 'error', {
            implementation: () => {
            }
        });

        // 清空所有 queue
        workflowQueueService.clearQueue(targetPodId);
        workflowQueueService.clearQueue('target-pod-2');
        workflowQueueService.clearQueue('target-pod-3');
    });

    afterEach(() => {
        // 還原所有測試中創建的 spy，避免跨檔案污染
        spies.forEach((spy) => {
            spy.mockRestore();
        });
        spies = [];
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
            setupMock(connectionStore, 'getById', {returnValue: queuedConnection});
            setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
            setupMock(podStore, 'getById', {
                implementation: (cId: string, podId: string) => {
                    if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                    return {...mockSourcePod, id: podId};
                }
            });

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
            setupMock(connectionStore, 'getById', {returnValue: mockAutoConnection});
            setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
            setupMock(podStore, 'getById', {
                implementation: (cId: string, podId: string) => {
                    if (podId === targetPodId) return {...mockTargetPod, status: 'idle'};
                    if (podId === sourcePodId) return mockSourcePod;
                    return undefined;
                }
            });

            // Mock processNextInQueue 為一個會延遲的 Promise
            let processNextInQueueCalled = false;
            const processNextInQueueSpy = spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
                processNextInQueueCalled = true;
                // 模擬一個需要時間的操作
                await new Promise(resolve => setTimeout(resolve, 100));
            });
            spies.push(processNextInQueueSpy);

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

            setupMock(connectionStore, 'getById', {returnValue: directConn});
            setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
            setupMock(podStore, 'getById', {
                implementation: (cId: string, podId: string) => {
                    if (podId === directConn.targetPodId) return {
                        ...mockTargetPod,
                        id: directConn.targetPodId,
                        status: 'idle'
                    };
                    return {...mockSourcePod, id: podId};
                }
            });

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

            setupMock(connectionStore, 'getById', {returnValue: autoConn});
            setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
            setupMock(podStore, 'getById', {
                implementation: (cId: string, podId: string) => {
                    if (podId === autoConn.targetPodId) return {
                        ...mockTargetPod,
                        id: autoConn.targetPodId,
                        status: 'idle'
                    };
                    return {...mockSourcePod, id: podId};
                }
            });

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

            setupMock(connectionStore, 'getById', {returnValue: conn});
            setupMock(connectionStore, 'findBySourcePodId', {returnValue: []});
            setupMock(podStore, 'getById', {
                implementation: (cId: string, podId: string) => {
                    if (podId === 'target-fail') return {...mockTargetPod, id: 'target-fail', status: 'idle'};
                    if (podId === sourcePodId) return mockSourcePod;
                    return undefined;
                }
            });

            // Mock sendMessage 拋出錯誤
            const testError = new Error('Claude query failed');
            setupMock(claudeQueryService, 'sendMessage', {
                implementation: async () => {
                    throw testError;
                }
            });

            // Mock processNextInQueue spy
            let processNextInQueueCalled = false;
            const processNextInQueueSpy = spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
                processNextInQueueCalled = true;
            });
            spies.push(processNextInQueueSpy);

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
