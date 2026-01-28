// Phase 4: Workflow Flow 測試
// 測試 Workflow 的觸發、清除和多來源合併功能

// 必須在最前面導入 Mock，確保 Mock 在模組載入前設定
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
  type ConnectionUpdatePayload,
  type ConnectionUpdatedPayload,
  type WorkflowAutoTriggeredPayload,
  type WorkflowGetDownstreamPodsPayload,
  type WorkflowGetDownstreamPodsResultPayload,
  type WorkflowClearPayload,
  type WorkflowClearResultPayload,
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
} from '../../src/types/index.js';

describe('Phase 4: Workflow Flow', () => {
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

  describe('Workflow 觸發', () => {
    it('Chat 完成後應自動觸發下游 Workflow', async () => {
      // 設定 Mock 回應
      const expectedContent = 'This is the workflow test response.';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 2 個 Pod（A, B）
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

      // 建立 Connection（A->B, autoTrigger: true）
      const connectionPayload: ConnectionCreatePayload = createTestConnectionPayload(
        podAId,
        podBId,
        { sourceAnchor: 'bottom', targetAnchor: 'top' }
      );

      const connection = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connection.success).toBe(true);
      expect(connection.connection?.autoTrigger).toBe(true); // 預設為 true

      // 加入兩個 Pod 的 Room
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

      // 對 Pod A 發送聊天訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podAId,
        message: 'Hello from Pod A',
      };

      // 等待 Pod A 的 chat complete 事件
      const podACompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        15000
      );

      // 等待 workflow:auto-triggered 事件
      const workflowAutoTriggeredPromise = waitForEvent<WorkflowAutoTriggeredPayload>(
        client,
        WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
        20000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      // 驗證 Pod A 完成
      const podACompleteEvent = await podACompletePromise;
      expect(podACompleteEvent.podId).toBe(podAId);
      expect(podACompleteEvent.fullContent).toBe(expectedContent);

      // 驗證 workflow 自動觸發
      const workflowEvent = await workflowAutoTriggeredPromise;
      expect(workflowEvent.sourcePodId).toBe(podAId);
      expect(workflowEvent.targetPodId).toBe(podBId);
      expect(workflowEvent.transferredContent).toBeDefined();
      expect(workflowEvent.connectionId).toBe(connection.connection!.id);
    });

    it('autoTrigger 為 false 時不應自動觸發 Workflow', async () => {
      // 設定 Mock 回應
      const expectedContent = 'No auto-trigger response.';
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

      // 建立 Connection 並設定 autoTrigger: false
      const connectionPayload = createTestConnectionPayload(podAId, podBId);
      const connection = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connection.success).toBe(true);

      // 更新 Connection 的 autoTrigger 為 false
      const updatePayload: ConnectionUpdatePayload = {
        requestId: uuidv4(),
        connectionId: connection.connection!.id,
        autoTrigger: false,
      };

      const updateResponse = await emitAndWaitResponse<
        ConnectionUpdatePayload,
        ConnectionUpdatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.connection?.autoTrigger).toBe(false);

      // 加入 Pod A 的 Room
      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId: podAId }
      );

      // 對來源 Pod 發送聊天訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podAId,
        message: 'Hello from Pod A',
      };

      // 監聽 workflow:auto-triggered 事件（不應該收到）
      let workflowTriggered = false;
      const autoTriggerHandler = () => {
        workflowTriggered = true;
      };
      client.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, autoTriggerHandler);

      // 等待 Pod A 的 chat complete 事件
      const podACompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      // 驗證 Pod A 完成
      const podACompleteEvent = await podACompletePromise;
      expect(podACompleteEvent.podId).toBe(podAId);

      // 等待一段時間確認沒有觸發 workflow
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 驗證沒有收到 workflow:auto-triggered 事件
      expect(workflowTriggered).toBe(false);

      // 清理監聽器
      client.off(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, autoTriggerHandler);
    });
  });

  describe('Workflow 清除', () => {
    it('應能取得下游 Pod 列表', async () => {
      // 建立 3 個 Pod（A, B, C）
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

      const podC = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod C' })
      );

      expect(podA.success).toBe(true);
      expect(podB.success).toBe(true);
      expect(podC.success).toBe(true);

      const podAId = podA.pod!.id;
      const podBId = podB.pod!.id;
      const podCId = podC.pod!.id;

      // 建立 Connection（A->B, B->C）
      await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podAId, podBId)
      );

      await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podBId, podCId)
      );

      // 取得下游 Pod 列表
      const getDownstreamPayload: WorkflowGetDownstreamPodsPayload = {
        requestId: uuidv4(),
        sourcePodId: podAId,
      };

      const downstreamResponse = await emitAndWaitResponse<
        WorkflowGetDownstreamPodsPayload,
        WorkflowGetDownstreamPodsResultPayload
      >(
        client,
        WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        getDownstreamPayload
      );

      expect(downstreamResponse.success).toBe(true);
      expect(downstreamResponse.pods).toBeDefined();
      expect(downstreamResponse.pods!.length).toBe(3); // A, B 和 C（包含來源 Pod）

      // 驗證回傳的 pods 包含 A, B 和 C
      const podIds = downstreamResponse.pods!.map((p) => p.id);
      expect(podIds).toContain(podAId);
      expect(podIds).toContain(podBId);
      expect(podIds).toContain(podCId);
    });

    it('應能清除下游 Pod 的聊天記錄', async () => {
      // 設定 Mock 回應
      const expectedContent = 'Test message for clear';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 2 個 Pod（A, B）
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

      // 建立 Connection
      await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podAId, podBId)
      );

      // 加入兩個 Pod 的 Room
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

      // 對 Pod A 發送聊天訊息
      const chatPayloadA: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podAId,
        message: 'Message for Pod A',
      };

      const podACompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayloadA);
      await podACompletePromise;

      // 對 Pod B 發送聊天訊息
      const chatPayloadB: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podBId,
        message: 'Message for Pod B',
      };

      const podBCompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayloadB);
      await podBCompletePromise;

      // 稍微等待，確保訊息已被儲存
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 清除下游 Pod 的聊天記錄
      const clearPayload: WorkflowClearPayload = {
        requestId: uuidv4(),
        sourcePodId: podAId,
      };

      const clearResponse = await emitAndWaitResponse<
        WorkflowClearPayload,
        WorkflowClearResultPayload
      >(
        client,
        WebSocketRequestEvents.WORKFLOW_CLEAR,
        WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        clearPayload
      );

      expect(clearResponse.success).toBe(true);
      expect(clearResponse.clearedPodIds).toBeDefined();
      expect(clearResponse.clearedPodIds).toContain(podBId);

      // 驗證 Pod B 的聊天記錄已被清除
      const historyPayload: PodChatHistoryPayload = {
        requestId: uuidv4(),
        podId: podBId,
      };

      const historyResponse = await emitAndWaitResponse<
        PodChatHistoryPayload,
        PodChatHistoryResultPayload
      >(
        client,
        WebSocketRequestEvents.POD_CHAT_HISTORY,
        WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
        historyPayload
      );

      expect(historyResponse.success).toBe(true);
      expect(historyResponse.messages).toBeDefined();
      // 聊天記錄應該被清除（長度為 0 或僅有系統訊息）
      expect(historyResponse.messages!.length).toBe(0);
    });
  });

  describe('多來源合併', () => {
    it('多個來源 Pod 完成後應合併內容發送至目標 Pod', async () => {
      // 設定 Mock 回應
      const expectedContent = 'Multi-source merge response';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 3 個 Pod（A, B, C）
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

      const podC = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod C' })
      );

      expect(podA.success).toBe(true);
      expect(podB.success).toBe(true);
      expect(podC.success).toBe(true);

      const podAId = podA.pod!.id;
      const podBId = podB.pod!.id;
      const podCId = podC.pod!.id;

      // 建立 2 個 Connection（A->C, B->C）
      await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podAId, podCId)
      );

      await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podBId, podCId)
      );

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

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId: podCId }
      );

      // 對 Pod A 發送訊息並等待完成
      const chatPayloadA: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podAId,
        message: 'Message from Pod A',
      };

      // 等待 workflow:pending 事件
      const pendingPromise = waitForEvent<WorkflowPendingPayload>(
        client,
        WebSocketResponseEvents.WORKFLOW_PENDING,
        15000
      );

      const podACompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        15000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayloadA);

      // 等待 Pod A 完成
      await podACompletePromise;

      // 驗證 pending 事件
      const pendingEvent = await pendingPromise;
      expect(pendingEvent.targetPodId).toBe(podCId);
      expect(pendingEvent.completedSourcePodIds).toContain(podAId);
      expect(pendingEvent.pendingSourcePodIds).toContain(podBId);
      expect(pendingEvent.totalSources).toBe(2);
      expect(pendingEvent.completedCount).toBe(1);

      // 對 Pod B 發送訊息並等待完成
      const chatPayloadB: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podBId,
        message: 'Message from Pod B',
      };

      // 等待 workflow:sources-merged 事件
      const mergedPromise = waitForEvent<WorkflowSourcesMergedPayload>(
        client,
        WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
        15000
      );

      const podBCompletePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        15000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayloadB);

      // 等待 Pod B 完成
      await podBCompletePromise;

      // 驗證 sources-merged 事件
      const mergedEvent = await mergedPromise;
      expect(mergedEvent.targetPodId).toBe(podCId);
      expect(mergedEvent.sourcePodIds.length).toBe(2);
      expect(mergedEvent.sourcePodIds).toContain(podAId);
      expect(mergedEvent.sourcePodIds).toContain(podBId);
      expect(mergedEvent.mergedContentPreview).toBeDefined();
    });
  });
});
