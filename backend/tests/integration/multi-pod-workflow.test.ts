// 多 Pod 工作流測試
// 測試多個 Pod 之間的工作流觸發與執行

import '../mocks/claudeSdkMock.js';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  waitForEvent,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createTestPodPayload, createTestConnectionPayload } from '../fixtures/index.js';
import {
  setMockResponse,
  resetMock,
  createDefaultTextResponse,
} from '../mocks/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
  type PodChatSendPayload,
  type PodChatCompletePayload,
  type PodChatHistoryPayload,
  type PodChatHistoryResultPayload,
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type ConnectionDeletePayload,
  type ConnectionDeletedPayload,
  type WorkflowAutoTriggeredPayload,
} from '../../src/types/index.js';

describe('多 Pod 工作流', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl);
    resetMock();
  });

  afterEach(async () => {
    resetMock();
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  it('線性工作流（A → B）', { timeout: 30000 }, async () => {
    // 設定 Mock 回應
    const expectedContent = 'Workflow test response';
    setMockResponse(createDefaultTextResponse(expectedContent));

    // 建立 2 個 Pod
    const podA = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      createTestPodPayload({ name: 'Pod A' })
    );

    const podB = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      createTestPodPayload({ name: 'Pod B' })
    );

    expect(podA.success).toBe(true);
    expect(podB.success).toBe(true);

    const podAId = podA.pod!.id;
    const podBId = podB.pod!.id;

    // 建立 Connection A→B (autoTrigger: true)
    const connectionAB = await emitAndWaitResponse<
      ConnectionCreatePayload,
      ConnectionCreatedPayload
    >(
      client,
      WebSocketRequestEvents.CONNECTION_CREATE,
      WebSocketResponseEvents.CONNECTION_CREATED,
      createTestConnectionPayload(podAId, podBId)
    );

    expect(connectionAB.success).toBe(true);
    expect(connectionAB.connection?.autoTrigger).toBe(true);

    // 加入所有 Pod 的 Room
    await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
      client,
      WebSocketRequestEvents.POD_JOIN,
      WebSocketResponseEvents.POD_JOINED,
      { podId: podAId }
    );

    await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
      client,
      WebSocketRequestEvents.POD_JOIN,
      WebSocketResponseEvents.POD_JOINED,
      { podId: podBId }
    );

    // 對 Pod A 發送訊息
    const chatPayload: PodChatSendPayload = {
      requestId: uuidv4(),
      podId: podAId,
      message: 'Start workflow from Pod A',
    };

    // 同時等待 Pod A 完成和 workflow 觸發事件
    const podACompletePromise = waitForEvent<PodChatCompletePayload>(
      client,
      WebSocketResponseEvents.POD_CHAT_COMPLETE,
      20000
    );

    const workflowABPromise = waitForEvent<WorkflowAutoTriggeredPayload>(
      client,
      WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
      20000
    );

    client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

    const podACompleteEvent = await podACompletePromise;
    expect(podACompleteEvent.podId).toBe(podAId);

    // 驗證 workflow:auto-triggered 事件觸發（A→B）
    const workflowABEvent = await workflowABPromise;
    expect(workflowABEvent.sourcePodId).toBe(podAId);
    expect(workflowABEvent.targetPodId).toBe(podBId);
    expect(workflowABEvent.transferredContent).toBeDefined();

    // 等待 Pod B 完成
    const podBCompletePromise = waitForEvent<PodChatCompletePayload>(
      client,
      WebSocketResponseEvents.POD_CHAT_COMPLETE,
      20000
    );

    const podBCompleteEvent = await podBCompletePromise;
    expect(podBCompleteEvent.podId).toBe(podBId);

    // 驗證 Pod A 和 Pod B 都完成處理
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 驗證 Pod A 的 chat history 有訊息
    const historyAPayload: PodChatHistoryPayload = {
      requestId: uuidv4(),
      podId: podAId,
    };

    const historyAResponse = await emitAndWaitResponse<
      PodChatHistoryPayload,
      PodChatHistoryResultPayload
    >(
      client,
      WebSocketRequestEvents.POD_CHAT_HISTORY,
      WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
      historyAPayload
    );

    expect(historyAResponse.success).toBe(true);
    expect(historyAResponse.messages).toBeDefined();
    expect(historyAResponse.messages!.length).toBeGreaterThan(0);
  });

  it('刪除 Connection 後 Workflow 不再觸發', async () => {
    // 設定 Mock 回應
    const expectedContent = 'No trigger response';
    setMockResponse(createDefaultTextResponse(expectedContent));

    // 建立 2 個 Pod
    const podA = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      createTestPodPayload({ name: 'Pod A' })
    );

    const podB = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      createTestPodPayload({ name: 'Pod B' })
    );

    expect(podA.success).toBe(true);
    expect(podB.success).toBe(true);

    const podAId = podA.pod!.id;
    const podBId = podB.pod!.id;

    // 建立 Connection A→B
    const connection = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
      client,
      WebSocketRequestEvents.CONNECTION_CREATE,
      WebSocketResponseEvents.CONNECTION_CREATED,
      createTestConnectionPayload(podAId, podBId)
    );

    expect(connection.success).toBe(true);
    const connectionId = connection.connection!.id;

    // 刪除 Connection
    const deleteConnectionPayload: ConnectionDeletePayload = {
      requestId: uuidv4(),
      connectionId,
    };

    const deleteConnectionResponse = await emitAndWaitResponse<
      ConnectionDeletePayload,
      ConnectionDeletedPayload
    >(
      client,
      WebSocketRequestEvents.CONNECTION_DELETE,
      WebSocketResponseEvents.CONNECTION_DELETED,
      deleteConnectionPayload
    );

    expect(deleteConnectionResponse.success).toBe(true);

    // 加入 Pod A 的 Room
    await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
      client,
      WebSocketRequestEvents.POD_JOIN,
      WebSocketResponseEvents.POD_JOINED,
      { podId: podAId }
    );

    // 對 Pod A 發送訊息
    const chatPayload: PodChatSendPayload = {
      requestId: uuidv4(),
      podId: podAId,
      message: 'Test no trigger',
    };

    // 監聽 workflow:auto-triggered 事件（不應該收到）
    let workflowTriggered = false;
    const autoTriggerHandler = () => {
      workflowTriggered = true;
    };
    client.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, autoTriggerHandler);

    // 等待 Pod A 完成
    const podACompletePromise = waitForEvent<PodChatCompletePayload>(
      client,
      WebSocketResponseEvents.POD_CHAT_COMPLETE,
      10000
    );

    client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

    const podACompleteEvent = await podACompletePromise;
    expect(podACompleteEvent.podId).toBe(podAId);

    // 等待一段時間，確認沒有 workflow 觸發
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(workflowTriggered).toBe(false);

    // 清理監聽器
    client.off(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, autoTriggerHandler);
  });
});
