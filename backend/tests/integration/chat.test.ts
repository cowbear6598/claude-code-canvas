import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  waitForEvent,
  disconnectSocket,
  type TestServerInstance,
} from '../setup';
import { createPod, FAKE_UUID, getCanvasId } from '../helpers';

// Import 真實模組
import * as claudeSDK from '@anthropic-ai/claude-agent-sdk';

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

import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ChatSendPayload as PodChatSendPayload,
  type ChatHistoryPayload as PodChatHistoryPayload,
} from '../../src/schemas/index.js';
import {
  type PodChatHistoryResultPayload,
  type PodErrorPayload,
} from '../../src/types';

describe('Chat 管理', () => {
  let server: TestServerInstance;
  let client: TestWebSocketClient;

  // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
  let spies: Array<ReturnType<typeof spyOn>> = [];

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

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) await closeTestServer(server);
  });

  beforeEach(async () => {
    // 清空 spy 陣列
    spies = [];

    // 設定 Claude SDK mock
    setupMock(claudeSDK, 'query', { implementation: () => mockQuery() });

    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterEach(async () => {
    if (client?.connected) await disconnectSocket(client);

    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies = [];
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
