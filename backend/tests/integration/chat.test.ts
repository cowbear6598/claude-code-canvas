import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
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
import { createPod, FAKE_UUID, getCanvasId} from '../helpers/index.js';

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
      content: [{ text: 'Test response' }],
    },
  };

  await new Promise((resolve) => setTimeout(resolve, 1500));

  yield {
    type: 'result',
    subtype: 'success',
    result: 'Test response',
  };
}

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(() => mockQuery()),
}));
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ChatSendPayload as PodChatSendPayload,
  type ChatHistoryPayload as PodChatHistoryPayload,
  type PodJoinPayload,
} from '../../src/schemas/index.js';
import {
  type PodChatHistoryResultPayload,
  type PodJoinedPayload,
  type PodErrorPayload,
} from '../../src/types/index.js';

describe('Chat 管理', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) await closeTestServer(server);
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterEach(async () => {
    if (client?.connected) await disconnectSocket(client);
  });

  describe('發送聊天訊息', () => {
    it('failed_when_chat_send_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        canvasId,
        podId: FAKE_UUID,
        message: 'Hello',
      } satisfies PodChatSendPayload);

      const errorEvent = await errorPromise;
      expect(errorEvent.code).toBe('NOT_FOUND');
      expect(errorEvent.error).toContain('找不到');
    });

    it('failed_when_chat_send_while_pod_is_busy', async () => {
      const canvasId = await getCanvasId(client);
      const pod = await createPod(client, { name: 'Busy Pod' });

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { canvasId, podId: pod.id }
      );

      const firstMessagePromise = waitForEvent(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        canvasId,
        podId: pod.id,
        message: 'First',
      } satisfies PodChatSendPayload);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        canvasId,
        podId: pod.id,
        message: 'Second',
      } satisfies PodChatSendPayload);

      const errorEvent = await errorPromise;
      expect(errorEvent.code).toBe('POD_BUSY');
      expect(errorEvent.error).toContain('chatting');

      await firstMessagePromise;
    });

    it('failed_when_chat_send_while_pod_is_summarizing', async () => {
      const canvasId = await getCanvasId(client);
      const pod = await createPod(client, { name: 'Summarizing Pod' });

      const { podStore } = await import('../../src/services/podStore.js');
      podStore.setStatus(canvasId, pod.id, 'summarizing');

      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        canvasId,
        podId: pod.id,
        message: 'Hello',
      } satisfies PodChatSendPayload);

      const errorEvent = await errorPromise;
      expect(errorEvent.code).toBe('POD_BUSY');
      expect(errorEvent.error).toContain('summarizing');

      podStore.setStatus(canvasId, pod.id, 'idle');
    });
  });

  describe('取得聊天歷史', () => {
    it('success_when_chat_history_returns_empty_for_new_pod', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodChatHistoryPayload, PodChatHistoryResultPayload>(
        client,
        WebSocketRequestEvents.POD_CHAT_HISTORY,
        WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.messages).toEqual([]);
    });

    it('failed_when_chat_history_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodChatHistoryPayload, PodChatHistoryResultPayload>(
        client,
        WebSocketRequestEvents.POD_CHAT_HISTORY,
        WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
