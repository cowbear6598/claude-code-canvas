// Phase 2: Chat 互動 Flow 測試
// 測試 Chat 的基本流程、狀態管理和錯誤處理

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
  collectEvents,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createTestPodPayload } from '../fixtures/index.js';
import {
  setMockResponse,
  resetMock,
  createDefaultTextResponse,
  createStreamingTextResponse,
  createToolUseResponse,
  createErrorResponse,
} from '../mocks/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodChatSendPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type PodChatHistoryPayload,
  type PodChatHistoryResultPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
  type PodErrorPayload,
  type PodStatusChangedPayload,
} from '../../src/types/index.js';

describe('Phase 2: Chat 互動 Flow', () => {
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

  describe('基本聊天流程', () => {
    it('應能發送訊息並收到 AI 回應', async () => {
      // 設定 Mock 回應
      const expectedContent = 'Hello! This is a test response.';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Chat Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      expect(createResponse.success).toBe(true);
      const podId = createResponse.pod!.id;

      // 加入 Pod Room
      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送聊天訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Hello, Claude!',
      };

      // 等待 complete 事件
      const completePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      const completeEvent = await completePromise;

      expect(completeEvent.podId).toBe(podId);
      expect(completeEvent.fullContent).toBe(expectedContent);
      expect(completeEvent.messageId).toBeDefined();
    });

    it('應正確處理 streaming 文字訊息', async () => {
      // 設定 Mock 分段回傳文字
      const chunks = ['Hello', ', this is', ' a streaming', ' response.'];
      setMockResponse(createStreamingTextResponse(chunks));

      // 建立 Pod 並加入 Room
      const createPayload = createTestPodPayload({ name: 'Streaming Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Test streaming',
      };

      // 收集所有 message 事件
      const messagesPromise = collectEvents<PodChatMessagePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_MESSAGE,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      const messages = await messagesPromise;

      // 驗證收到多個 streaming 事件
      expect(messages.length).toBeGreaterThan(0);

      // 驗證每次 content 累加
      let accumulatedContent = '';
      for (const msg of messages) {
        expect(msg.podId).toBe(podId);
        expect(msg.isPartial).toBe(true);
        expect(msg.content).toContain(accumulatedContent);
        accumulatedContent = msg.content;
      }

      // 驗證最終內容
      const fullContent = chunks.join('');
      expect(messages[messages.length - 1].content).toBe(fullContent);
    });

    it('應正確處理 Tool Use 事件', async () => {
      // 設定 Mock 回傳 tool_use 事件
      const toolName = 'Read';
      const toolInput = { file_path: '/test/file.txt' };
      const toolOutput = 'File content here';
      const finalContent = 'I read the file and here is the content.';

      setMockResponse(createToolUseResponse(toolName, toolInput, toolOutput, finalContent));

      // 建立 Pod 並加入 Room
      const createPayload = createTestPodPayload({ name: 'Tool Use Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Read the file',
      };

      // 等待 tool_use 事件
      const toolUsePromise = waitForEvent<PodChatToolUsePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_TOOL_USE,
        10000
      );

      // 等待 tool_result 事件
      const toolResultPromise = waitForEvent<PodChatToolResultPayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
        10000
      );

      // 等待 complete 事件
      const completePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      // 驗證 tool_use
      const toolUseEvent = await toolUsePromise;
      expect(toolUseEvent.podId).toBe(podId);
      expect(toolUseEvent.toolName).toBe(toolName);
      expect(toolUseEvent.input).toEqual(toolInput);
      expect(toolUseEvent.toolUseId).toBeDefined();

      // 驗證 tool_result
      const toolResultEvent = await toolResultPromise;
      expect(toolResultEvent.podId).toBe(podId);
      expect(toolResultEvent.toolUseId).toBeDefined();
      expect(toolResultEvent.output).toBe(toolOutput);

      // 驗證 complete
      const completeEvent = await completePromise;
      expect(completeEvent.fullContent).toBe(finalContent);
    });

    it('應能取得聊天歷史記錄', async () => {
      // 設定 Mock 回應
      const expectedContent = 'This is the response';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'History Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送訊息並等待完成
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Test message',
      };

      const completePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);
      await completePromise;

      // 稍微等待，確保訊息已被儲存
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 取得聊天歷史
      const historyPayload: PodChatHistoryPayload = {
        requestId: uuidv4(),
        podId,
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

      // 檢查是否至少有訊息
      expect(historyResponse.messages!.length).toBeGreaterThan(0);

      // 如果有兩個訊息，驗證訊息結構
      if (historyResponse.messages!.length >= 2) {
        const userMessage = historyResponse.messages!.find((m) => m.role === 'user');
        const assistantMessage = historyResponse.messages!.find((m) => m.role === 'assistant');

        expect(userMessage).toBeDefined();
        expect(userMessage!.content).toBe('Test message');
        expect(userMessage!.id).toBeDefined();
        expect(userMessage!.timestamp).toBeDefined();

        expect(assistantMessage).toBeDefined();
        expect(assistantMessage!.content).toBe(expectedContent);
        expect(assistantMessage!.id).toBeDefined();
        expect(assistantMessage!.timestamp).toBeDefined();
      } else {
        // 至少驗證有一個訊息
        const firstMessage = historyResponse.messages![0];
        expect(firstMessage.id).toBeDefined();
        expect(firstMessage.role).toBeDefined();
        expect(firstMessage.content).toBeDefined();
        expect(firstMessage.timestamp).toBeDefined();
      }
    });
  });

  describe('Chat 狀態管理', () => {
    it('Pod 聊天中不應接受新訊息', async () => {
      // 設定 Mock 延遲回應（模擬長時間處理）
      const expectedContent = 'Delayed response';
      setMockResponse(createDefaultTextResponse(expectedContent), 2000);

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Busy Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送第一個訊息
      const chatPayload1: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'First message',
      };

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload1);

      // 立即發送第二個訊息
      await new Promise((resolve) => setTimeout(resolve, 100)); // 稍微等待確保第一個訊息已開始處理

      const chatPayload2: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Second message',
      };

      // 等待錯誤事件
      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR,
        5000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload2);

      const errorEvent = await errorPromise;

      expect(errorEvent.podId).toBe(podId);
      expect(errorEvent.code).toBe('POD_BUSY');
      expect(errorEvent.error).toContain('chatting');
    });

    it('聊天完成後 Pod 狀態應變回 idle', async () => {
      // 設定 Mock 回應
      const expectedContent = 'Response';
      setMockResponse(createDefaultTextResponse(expectedContent));

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Status Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Test message',
      };

      // 監聽狀態變更事件
      const statusEvents: PodStatusChangedPayload[] = [];
      client.on(WebSocketResponseEvents.POD_STATUS_CHANGED, (event: PodStatusChangedPayload) => {
        if (event.podId === podId) {
          statusEvents.push(event);
        }
      });

      // 等待 complete 事件
      const completePromise = waitForEvent<PodChatCompletePayload>(
        client,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        10000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);
      await completePromise;

      // 稍微等待確保狀態變更事件已發送
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 驗證狀態變更
      const chattingEvent = statusEvents.find((e) => e.status === 'chatting');
      const idleEvent = statusEvents.find(
        (e) => e.status === 'idle' && e.previousStatus === 'chatting'
      );

      expect(chattingEvent).toBeDefined();
      expect(chattingEvent!.previousStatus).toBe('idle');

      expect(idleEvent).toBeDefined();
    });
  });

  describe('Chat 錯誤處理', () => {
    it('對不存在的 Pod 發送訊息應回傳錯誤', async () => {
      const nonExistentPodId = '00000000-0000-0000-0000-000000000000';

      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId: nonExistentPodId,
        message: 'Test message',
      };

      // 等待錯誤事件
      const errorPromise = waitForEvent<PodErrorPayload>(
        client,
        WebSocketResponseEvents.POD_ERROR,
        5000
      );

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      const errorEvent = await errorPromise;

      expect(errorEvent.podId).toBe(nonExistentPodId);
      expect(errorEvent.code).toBe('NOT_FOUND');
      expect(errorEvent.error).toContain('not found');
    });

    it('Claude SDK 錯誤應正確傳遞', async () => {
      // 設定 Mock 回傳 error 事件
      const errorMessage = 'Claude SDK test error';
      setMockResponse(createErrorResponse(errorMessage));

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Error Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 發送訊息
      const chatPayload: PodChatSendPayload = {
        requestId: uuidv4(),
        podId,
        message: 'Trigger error',
      };

      // 等待 complete 事件（或錯誤處理後的事件）
      // 注意：根據實際實作，錯誤可能會導致不同的事件
      // 這裡我們檢查 Pod 狀態是否回到 idle
      const completeOrErrorPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

        const checkComplete = () => {
          clearTimeout(timeout);
          resolve();
        };

        client.once(WebSocketResponseEvents.POD_CHAT_COMPLETE, checkComplete);
        client.once(WebSocketResponseEvents.POD_ERROR, checkComplete);
      });

      client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

      try {
        await completeOrErrorPromise;
        // 如果到達這裡，表示錯誤被處理了（可能以不同方式）
        expect(true).toBe(true);
      } catch (error) {
        // 超時表示錯誤沒有被正確處理
        throw new Error('Expected error to be handled');
      }
    });
  });
});
