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
import { createPod, FAKE_UUID } from '../helpers/index.js';
import { setMockResponse, resetMock, createDefaultTextResponse } from '../mocks/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodChatSendPayload,
  type PodChatHistoryPayload,
  type PodChatHistoryResultPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
  type PodErrorPayload,
} from '../../src/types/index.js';

describe('chat', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) await closeTestServer(server);
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl);
    resetMock();
  });

  afterEach(async () => {
    resetMock();
    if (client?.connected) await disconnectSocket(client);
  });

  describe('handleChatSend', () => {
    it('failed_when_chat_send_with_nonexistent_pod', async () => {
      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        podId: FAKE_UUID,
        message: 'Hello',
      } satisfies PodChatSendPayload);

      const errorEvent = await errorPromise;
      expect(errorEvent.code).toBe('NOT_FOUND');
      expect(errorEvent.error).toContain('not found');
    });

    it('failed_when_chat_send_while_pod_is_busy', async () => {
      setMockResponse(createDefaultTextResponse('delayed'), 2000);

      const pod = await createPod(client, { name: 'Busy Pod' });

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId: pod.id }
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        podId: pod.id,
        message: 'First',
      } satisfies PodChatSendPayload);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: uuidv4(),
        podId: pod.id,
        message: 'Second',
      } satisfies PodChatSendPayload);

      const errorEvent = await errorPromise;
      expect(errorEvent.code).toBe('POD_BUSY');
      expect(errorEvent.error).toContain('chatting');
    });
  });

  describe('handleChatHistory', () => {
    it('success_when_chat_history_returns_empty_for_new_pod', async () => {
      const pod = await createPod(client);

      const response = await emitAndWaitResponse<PodChatHistoryPayload, PodChatHistoryResultPayload>(
        client,
        WebSocketRequestEvents.POD_CHAT_HISTORY,
        WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
        { requestId: uuidv4(), podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.messages).toEqual([]);
    });

    it('failed_when_chat_history_with_nonexistent_pod', async () => {
      const response = await emitAndWaitResponse<PodChatHistoryPayload, PodChatHistoryResultPayload>(
        client,
        WebSocketRequestEvents.POD_CHAT_HISTORY,
        WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
        { requestId: uuidv4(), podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });
});
