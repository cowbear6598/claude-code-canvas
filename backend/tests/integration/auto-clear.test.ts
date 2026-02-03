import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createPod, FAKE_UUID, getCanvasId} from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodSetAutoClearPayload,
} from '../../src/schemas/index.js';
import { type PodAutoClearSetPayload } from '../../src/types/index.js';

describe('自動清除', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('設定 Pod 自動清除', () => {
    it('success_when_auto_clear_set_to_true', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodSetAutoClearPayload, PodAutoClearSetPayload>(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        { requestId: uuidv4(), canvasId, podId: pod.id, autoClear: true }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.autoClear).toBe(true);
    });

    it('success_when_auto_clear_set_to_false', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodSetAutoClearPayload, PodAutoClearSetPayload>(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        { requestId: uuidv4(), canvasId, podId: pod.id, autoClear: true }
      );

      const response = await emitAndWaitResponse<PodSetAutoClearPayload, PodAutoClearSetPayload>(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        { requestId: uuidv4(), canvasId, podId: pod.id, autoClear: false }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.autoClear).toBe(false);
    });

    it('failed_when_set_auto_clear_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodSetAutoClearPayload, PodAutoClearSetPayload>(
        client,
        WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
        WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, autoClear: true }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
