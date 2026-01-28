// Phase 8: Auto-Clear Flow 測試
// 測試 Auto-Clear 功能的設定和自動清除下游 Pod

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
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type PodSetAutoClearPayload,
  type PodAutoClearSetPayload,
  type WorkflowAutoClearedPayload,
} from '../../src/types/index.js';

describe('Phase 8: Auto-Clear Flow', () => {
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

  describe('Auto-Clear 功能', () => {
    it('應能設定 Pod 的 autoClear 屬性', async () => {
      // 建立 Pod（預設 autoClear: false）
      const pod = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Test Pod' })
      );

      expect(pod.success).toBe(true);
      expect(pod.pod).toBeDefined();
      expect(pod.pod!.autoClear).toBe(false); // 預設為 false

      const podId = pod.pod!.id;

      // 設定 autoClear 為 true
      const setAutoClearPayload: PodSetAutoClearPayload = {
        requestId: uuidv4(),
        podId,
        autoClear: true,
      };

      const autoClearResponse = await emitAndWaitResponse<
        PodSetAutoClearPayload,
        PodAutoClearSetPayload
      >(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        setAutoClearPayload
      );

      expect(autoClearResponse.success).toBe(true);
      expect(autoClearResponse.pod).toBeDefined();
      expect(autoClearResponse.pod!.autoClear).toBe(true);
    });

    it('設定不存在的 Pod 的 autoClear 應回傳錯誤', async () => {
      // 使用有效的 UUID 格式，但對應不存在的 Pod
      const nonExistentPodId = uuidv4();

      const setAutoClearPayload: PodSetAutoClearPayload = {
        requestId: uuidv4(),
        podId: nonExistentPodId,
        autoClear: true,
      };

      const autoClearResponse = await emitAndWaitResponse<
        PodSetAutoClearPayload,
        PodAutoClearSetPayload
      >(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        setAutoClearPayload
      );

      expect(autoClearResponse.success).toBe(false);
      expect(autoClearResponse.error).toBeDefined();
      expect(autoClearResponse.error).toContain('not found');
    });

    it('Pod 完成後應根據 autoClear 設定自動清除下游', async () => {
      // 設定 Mock 回應
      const expectedContent = 'Auto-clear test response';
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

      // 設定 Pod A 的 autoClear 為 true
      const setAutoClearPayload: PodSetAutoClearPayload = {
        requestId: uuidv4(),
        podId: podAId,
        autoClear: true,
      };

      const autoClearResponse = await emitAndWaitResponse<
        PodSetAutoClearPayload,
        PodAutoClearSetPayload
      >(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        setAutoClearPayload
      );

      expect(autoClearResponse.success).toBe(true);
      expect(autoClearResponse.pod!.autoClear).toBe(true);

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

      // 對 Pod A 發送訊息
      const chatPayloadA: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: podAId,
        message: 'Message from Pod A',
      };

      // 等待 workflow:auto-cleared 事件（會在 Pod C 完成後自動觸發）
      const autoClearedPromise = waitForEvent<WorkflowAutoClearedPayload>(
        client,
        WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED,
        30000
      );

      // 發送訊息到 Pod A，觸發 workflow 鏈
      // workflow 會自動從 A -> B -> C，然後在 C 完成後觸發 auto-clear
      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayloadA);

      // 驗證 workflow:auto-cleared 事件
      const autoClearedEvent = await autoClearedPromise;
      expect(autoClearedEvent.sourcePodId).toBe(podAId);
      expect(autoClearedEvent.clearedPodIds).toBeDefined();
      expect(autoClearedEvent.clearedPodIds.length).toBeGreaterThan(0);
      // 應該清除下游 Pod（包含 A, B, C）
      expect(autoClearedEvent.clearedPodIds).toContain(podBId);
      expect(autoClearedEvent.clearedPodIds).toContain(podCId);
      expect(autoClearedEvent.clearedPodNames).toBeDefined();
    });
  });
});
