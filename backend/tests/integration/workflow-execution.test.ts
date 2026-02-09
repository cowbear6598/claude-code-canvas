import {
    createTestServer,
    closeTestServer,
    createSocketClient,
    waitForEvent,
    disconnectSocket,
    type TestServerInstance, TestWebSocketClient,
} from '../setup';
import {createPod, getCanvasId} from '../helpers';
import {createConnection} from '../helpers';
import {seedPodMessages} from '../helpers';
import {WebSocketResponseEvents} from '../../src/schemas';
import type {
    WorkflowAutoTriggeredPayload,
    WorkflowPendingPayload,
    WorkflowSourcesMergedPayload,
    PodChatCompletePayload,
} from '../../src/types';

// Mock Claude Agent SDK 的實作
async function* mockQuery(): AsyncGenerator<any> {
    yield {
        type: 'system',
        subtype: 'init',
        session_id: `test-session-${Date.now()}`,
    };

    await new Promise((resolve) => setTimeout(resolve, 50));

    yield {
        type: 'assistant',
        message: {
            content: [{text: 'Test workflow response'}],
        },
    };

    await new Promise((resolve) => setTimeout(resolve, 100));

    yield {
        type: 'result',
        subtype: 'success',
        result: 'Test workflow response',
    };
}

// 使用 vi.mock() 來 mock @anthropic-ai/claude-agent-sdk 的 query export
// ESM 模組的 namespace 是 readonly，無法用 vi.spyOn 修改
vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>();
  return {
    ...original,
    query: vi.fn((..._args: any[]) => mockQuery()),
  };
});

import * as claudeSDK from '@anthropic-ai/claude-agent-sdk';

describe('WorkflowExecution 服務', () => {
    let server: TestServerInstance;
    let client: TestWebSocketClient;

    beforeAll(async () => {
        server = await createTestServer();
    });

    afterAll(async () => {
        if (server) await closeTestServer(server);
    });

    beforeEach(async () => {
        // claudeAgentSdk.query 已透過頂層 vi.mock() 處理
        // 每次測試前清除呼叫紀錄
        (claudeSDK.query as any).mockClear();

        client = await createSocketClient(server.baseUrl, server.canvasId);
    });

    afterEach(async () => {
        if (client?.connected) await disconnectSocket(client);

        vi.restoreAllMocks();
    });

    describe('測試 checkAndTriggerWorkflows 的 auto-trigger 邏輯', () => {
        it('自動觸發成功啟動目標 Pod', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立 sourcePod、targetPod
            const sourcePod = await createPod(client, {name: 'Source Pod', x: 0, y: 0});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 300, y: 0});

            // 設定 auto trigger mode connection
            const connection = await createConnection(client, sourcePod.id, targetPod.id, {
                triggerMode: 'auto',
            });

            expect(connection.triggerMode).toBe('auto');

            // 監聽 workflow auto-triggered 事件
            const autoTriggeredPromise = waitForEvent<WorkflowAutoTriggeredPayload>(
                client,
                WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
                10000
            );

            // 監聽 workflow complete 事件（確保整個 workflow 完成）
            const workflowCompletePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Workflow complete timeout'));
                }, 10000);

                const handler = (event: any) => {
                    if (event.targetPodId === targetPod.id && event.success) {
                        clearTimeout(timeout);
                        client.off(WebSocketResponseEvents.WORKFLOW_COMPLETE, handler);
                        resolve(event);
                    }
                };
                client.on(WebSocketResponseEvents.WORKFLOW_COMPLETE, handler);
            });

            // 執行：發送訊息到 source pod，觸發 workflow
            await seedPodMessages(client, sourcePod.id, [
                {role: 'user', content: 'Test message to trigger workflow'},
            ]);

            // 驗證：收到 auto-triggered 事件
            const autoTriggeredEvent = await autoTriggeredPromise;
            expect(autoTriggeredEvent.sourcePodId).toBe(sourcePod.id);
            expect(autoTriggeredEvent.targetPodId).toBe(targetPod.id);
            expect(autoTriggeredEvent.connectionId).toBe(connection.id);
            expect(autoTriggeredEvent.transferredContent).toBeDefined();

            // 驗證：等待 workflow 完成
            await workflowCompletePromise;

            // 驗證：檢查 target pod 的狀態
            const {podStore} = await import('../../src/services/podStore.js');
            const targetPodAfter = podStore.getById(canvasId, targetPod.id);
            expect(targetPodAfter?.status).toBe('idle');
        });

        it('目標 Pod 忙碌時跳過自動觸發', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立 sourcePod、targetPod
            const sourcePod = await createPod(client, {name: 'Source Pod', x: 0, y: 0});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 300, y: 0});

            // 設定 auto trigger mode connection
            await createConnection(client, sourcePod.id, targetPod.id, {
                triggerMode: 'auto',
            });

            // 將 target pod 設為 chatting 狀態
            const {podStore} = await import('../../src/services/podStore.js');
            podStore.setStatus(canvasId, targetPod.id, 'chatting');

            // 發送訊息到 source pod
            await seedPodMessages(client, sourcePod.id, [
                {role: 'user', content: 'Test message while target is busy'},
            ]);

            // 等待一段時間，確保不會觸發 auto-trigger
            await new Promise((resolve) => setTimeout(resolve, 500));

            // 驗證：target pod 狀態沒有改變（仍然是 chatting）
            const targetPodAfter = podStore.getById(canvasId, targetPod.id);
            expect(targetPodAfter?.status).toBe('chatting');

            // 清理：重置狀態
            podStore.setStatus(canvasId, targetPod.id, 'idle');
        });
    });

    describe('測試 multi-input 情境（多個 source 連接到同一 target）', () => {
        it('等待所有 source 完成後觸發', async () => {
            await getCanvasId(client);

            // 準備：建立 sourceA、sourceB、targetPod
            const sourceA = await createPod(client, {name: 'Source A', x: 0, y: 0});
            const sourceB = await createPod(client, {name: 'Source B', x: 0, y: 200});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 400, y: 100});

            // 設定兩個 auto trigger mode connections
            await createConnection(client, sourceA.id, targetPod.id, {
                triggerMode: 'auto',
            });

            await createConnection(client, sourceB.id, targetPod.id, {
                triggerMode: 'auto',
            });

            // 監聽 pending 事件
            const pendingPromise = waitForEvent<WorkflowPendingPayload>(
                client,
                WebSocketResponseEvents.WORKFLOW_PENDING,
                10000
            );

            // 執行：sourceA 完成
            await seedPodMessages(client, sourceA.id, [
                {role: 'user', content: 'Message from source A'},
            ]);

            // 驗證：收到 pending 狀態，等待 sourceB
            const pendingEvent = await pendingPromise;
            expect(pendingEvent.targetPodId).toBe(targetPod.id);
            expect(pendingEvent.completedSourcePodIds).toContain(sourceA.id);
            expect(pendingEvent.pendingSourcePodIds).toContain(sourceB.id);
            expect(pendingEvent.completedCount).toBe(1);
            expect(pendingEvent.totalSources).toBe(2);

            // 監聽 sources merged 和 auto-triggered 事件
            const mergedPromise = waitForEvent<WorkflowSourcesMergedPayload>(
                client,
                WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
                10000
            );
            const autoTriggeredPromise = waitForEvent<WorkflowAutoTriggeredPayload>(
                client,
                WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
                10000
            );

            // 執行：sourceB 完成
            await seedPodMessages(client, sourceB.id, [
                {role: 'user', content: 'Message from source B'},
            ]);

            // 驗證：收到 merged 事件
            const mergedEvent = await mergedPromise;
            expect(mergedEvent.targetPodId).toBe(targetPod.id);
            expect(mergedEvent.sourcePodIds).toContain(sourceA.id);
            expect(mergedEvent.sourcePodIds).toContain(sourceB.id);
            expect(mergedEvent.mergedContentPreview).toBeDefined();

            // 驗證：收到 auto-triggered 事件，觸發 target
            const autoTriggeredEvent = await autoTriggeredPromise;
            expect(autoTriggeredEvent.targetPodId).toBe(targetPod.id);
            expect(autoTriggeredEvent.isSummarized).toBe(true);
        });

        it('未完成時不會提前觸發', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立 sourceA、sourceB、targetPod
            const sourceA = await createPod(client, {name: 'Source A', x: 0, y: 0});
            const sourceB = await createPod(client, {name: 'Source B', x: 0, y: 200});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 400, y: 100});

            // 設定兩個 auto trigger mode connections
            await createConnection(client, sourceA.id, targetPod.id, {
                triggerMode: 'auto',
            });
            await createConnection(client, sourceB.id, targetPod.id, {
                triggerMode: 'auto',
            });

            // 監聽 auto-triggered 事件（不應該發生）
            let autoTriggered = false;
            client.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, () => {
                autoTriggered = true;
            });

            // 執行：只有 sourceA 完成
            await seedPodMessages(client, sourceA.id, [
                {role: 'user', content: 'Only source A completes'},
            ]);

            // 等待一段時間
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // 驗證：沒有觸發 auto-triggered（因為 sourceB 還沒完成）
            expect(autoTriggered).toBe(false);

            // 驗證：target pod 狀態仍然是 idle
            const {podStore} = await import('../../src/services/podStore.js');
            const targetPodAfter = podStore.getById(canvasId, targetPod.id);
            expect(targetPodAfter?.status).toBe('idle');
        });
    });

    describe('測試 workflow 鏈式觸發（A -> B -> C）', () => {
        it('鏈式觸發依序執行', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立三個 Pod 的鏈式連接
            const podA = await createPod(client, {name: 'Pod A', x: 0, y: 0});
            const podB = await createPod(client, {name: 'Pod B', x: 300, y: 0});
            const podC = await createPod(client, {name: 'Pod C', x: 600, y: 0});

            const connAB = await createConnection(client, podA.id, podB.id, {
                triggerMode: 'auto',
            });
            const connBC = await createConnection(client, podB.id, podC.id, {
                triggerMode: 'auto',
            });

            // 收集所有 auto-triggered 事件
            const autoTriggeredEvents: WorkflowAutoTriggeredPayload[] = [];
            client.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, (event) => {
                autoTriggeredEvents.push(event);
            });

            // 監聽 Pod C 的聊天完成事件（最終目標）
            const podCCompletePromise = new Promise<PodChatCompletePayload>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Pod C complete timeout'));
                }, 15000);

                const completedPods = new Set<string>();
                const handler = (event: PodChatCompletePayload) => {
                    completedPods.add(event.podId);
                    // 等待所有三個 Pod 都完成
                    if (completedPods.has(podA.id) && completedPods.has(podB.id) && completedPods.has(podC.id)) {
                        clearTimeout(timeout);
                        client.off(WebSocketResponseEvents.POD_CHAT_COMPLETE, handler);
                        resolve(event);
                    }
                };
                client.on(WebSocketResponseEvents.POD_CHAT_COMPLETE, handler);
            });

            // 執行：觸發 Pod A
            await seedPodMessages(client, podA.id, [
                {role: 'user', content: 'Start the workflow chain'},
            ]);

            // 驗證：等待整個鏈式觸發完成
            const podCComplete = await podCCompletePromise;
            expect(podCComplete).toBeDefined();

            // 等待一小段時間確保所有事件都收集完成
            await new Promise((resolve) => setTimeout(resolve, 500));

            // 驗證：B 和 C 都收到觸發（A->B, B->C）
            expect(autoTriggeredEvents.length).toBeGreaterThanOrEqual(2);

            const triggerToB = autoTriggeredEvents.find(
                (e) => e.sourcePodId === podA.id && e.targetPodId === podB.id
            );
            const triggerToC = autoTriggeredEvents.find(
                (e) => e.sourcePodId === podB.id && e.targetPodId === podC.id
            );

            expect(triggerToB).toBeDefined();
            expect(triggerToC).toBeDefined();
            expect(triggerToB?.connectionId).toBe(connAB.id);
            expect(triggerToC?.connectionId).toBe(connBC.id);

            // 驗證：所有 Pod 最終狀態為 idle
            const {podStore} = await import('../../src/services/podStore.js');
            expect(podStore.getById(canvasId, podA.id)?.status).toBe('idle');
            expect(podStore.getById(canvasId, podB.id)?.status).toBe('idle');
            expect(podStore.getById(canvasId, podC.id)?.status).toBe('idle');
        }, 20000);

        it('多分支鏈式觸發成功執行', async () => {
            await getCanvasId(client);

            // 準備：建立分支結構 (A -> B, A -> C, B -> D)
            const podA = await createPod(client, {name: 'Pod A', x: 0, y: 0});
            const podB = await createPod(client, {name: 'Pod B', x: 300, y: -100});
            const podC = await createPod(client, {name: 'Pod C', x: 300, y: 100});
            const podD = await createPod(client, {name: 'Pod D', x: 600, y: -100});

            await createConnection(client, podA.id, podB.id, {triggerMode: 'auto'});
            await createConnection(client, podA.id, podC.id, {triggerMode: 'auto'});
            await createConnection(client, podB.id, podD.id, {triggerMode: 'auto'});

            // 收集所有 auto-triggered 事件
            const autoTriggeredEvents: WorkflowAutoTriggeredPayload[] = [];
            client.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, (event) => {
                autoTriggeredEvents.push(event);
            });

            // 監聽所有 Pod 的完成事件
            const completedPods = new Set<string>();
            client.on(WebSocketResponseEvents.POD_CHAT_COMPLETE, (event) => {
                completedPods.add(event.podId);
            });

            // 執行：觸發 Pod A
            await seedPodMessages(client, podA.id, [
                {role: 'user', content: 'Start branching workflow'},
            ]);

            // 等待所有 Pod 完成（最多等待 15 秒）
            const startTime = Date.now();
            while (completedPods.size < 4 && Date.now() - startTime < 15000) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // 驗證：所有 Pod 都完成了
            expect(completedPods.has(podA.id)).toBe(true);
            expect(completedPods.has(podB.id)).toBe(true);
            expect(completedPods.has(podC.id)).toBe(true);
            expect(completedPods.has(podD.id)).toBe(true);

            // 驗證：收到正確的 auto-triggered 事件（A->B, A->C, B->D）
            expect(autoTriggeredEvents.length).toBeGreaterThanOrEqual(3);
            expect(autoTriggeredEvents.some((e) => e.sourcePodId === podA.id && e.targetPodId === podB.id)).toBe(true);
            expect(autoTriggeredEvents.some((e) => e.sourcePodId === podA.id && e.targetPodId === podC.id)).toBe(true);
            expect(autoTriggeredEvents.some((e) => e.sourcePodId === podB.id && e.targetPodId === podD.id)).toBe(true);
        });
    });

    describe('測試 triggerWorkflowWithSummary 的 pre-generated summary 處理', () => {
        it('使用預生成摘要成功觸發', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立 connection，準備 mock summary
            const sourcePod = await createPod(client, {name: 'Source Pod', x: 0, y: 0});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 300, y: 0});
            const connection = await createConnection(client, sourcePod.id, targetPod.id, {
                triggerMode: 'auto',
            });

            // 先給 source pod 一些訊息
            await seedPodMessages(client, sourcePod.id, [
                {role: 'user', content: 'Initial message for summary test'},
            ]);

            const preGeneratedSummary = 'This is a pre-generated summary for testing purposes.';

            // 監聽 auto-triggered 事件
            const autoTriggeredPromise = waitForEvent<WorkflowAutoTriggeredPayload>(
                client,
                WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
                10000
            );

            // 執行：直接呼叫 triggerWorkflowWithSummary
            const {workflowExecutionService} = await import('../../src/services/workflow/workflowExecutionService.js');
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                connection.id,
                preGeneratedSummary,
                true
            );

            // 驗證：收到 auto-triggered 事件，並且 summary 正確傳遞
            const autoTriggeredEvent = await autoTriggeredPromise;
            expect(autoTriggeredEvent.sourcePodId).toBe(sourcePod.id);
            expect(autoTriggeredEvent.targetPodId).toBe(targetPod.id);
            expect(autoTriggeredEvent.transferredContent).toBe(preGeneratedSummary);
            expect(autoTriggeredEvent.isSummarized).toBe(true);

            // 驗證：target pod 收到正確的內容
            const {messageStore} = await import('../../src/services/messageStore.js');
            const targetMessages = messageStore.getMessages(targetPod.id);
            const userMessage = targetMessages.find((m) => m.role === 'user');
            expect(userMessage).toBeDefined();
            expect(userMessage?.content).toContain(preGeneratedSummary);
        });

        it('多個 source 使用預生成摘要成功觸發', async () => {
            const canvasId = await getCanvasId(client);

            // 準備：建立多個 source 連接到同一 target
            const sourceA = await createPod(client, {name: 'Source A', x: 0, y: 0});
            const sourceB = await createPod(client, {name: 'Source B', x: 0, y: 200});
            const targetPod = await createPod(client, {name: 'Target Pod', x: 400, y: 100});

            const connA = await createConnection(client, sourceA.id, targetPod.id, {
                triggerMode: 'auto',
            });

            // 給兩個 source 都添加訊息
            await seedPodMessages(client, sourceA.id, [
                {role: 'user', content: 'Message from A'},
            ]);
            await seedPodMessages(client, sourceB.id, [
                {role: 'user', content: 'Message from B'},
            ]);

            // 準備合併的 summary
            const mergedSummary = `## Source: Source A
Content from Source A

---

## Source: Source B
Content from Source B`;

            // 監聽 target pod 完成事件
            const targetCompletePromise = new Promise<PodChatCompletePayload>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Target complete timeout'));
                }, 10000);

                const handler = (event: PodChatCompletePayload) => {
                    if (event.podId === targetPod.id) {
                        clearTimeout(timeout);
                        client.off(WebSocketResponseEvents.POD_CHAT_COMPLETE, handler);
                        resolve(event);
                    }
                };
                client.on(WebSocketResponseEvents.POD_CHAT_COMPLETE, handler);
            });

            // 執行：使用 pre-generated merged summary
            const {workflowExecutionService} = await import('../../src/services/workflow/workflowExecutionService.js');
            await workflowExecutionService.triggerWorkflowWithSummary(
                canvasId,
                connA.id,
                mergedSummary,
                true
            );

            // 等待 target pod 完成
            await targetCompletePromise;

            // 驗證：target pod 收到合併的內容
            const {messageStore} = await import('../../src/services/messageStore.js');
            const targetMessages = messageStore.getMessages(targetPod.id);
            const userMessages = targetMessages.filter((m) => m.role === 'user');
            // 應該有兩條 user 訊息：第一條是 auto-trigger，第二條是 pre-generated summary
            expect(userMessages.length).toBeGreaterThanOrEqual(1);

            // 檢查最後一條 user message 是否包含我們的 merged summary
            const lastUserMessage = userMessages[userMessages.length - 1];
            expect(lastUserMessage).toBeDefined();
            // 驗證 transferredContent 包含了 merged summary（通過檢查是否有分隔符）
            expect(lastUserMessage.content).toContain('---');
        });
    });
});
