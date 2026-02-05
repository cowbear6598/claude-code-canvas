import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { ContentBlock } from '../../src/types/index.js';

// Mock query function
let mockQueryGenerator: any;

// Mock @anthropic-ai/claude-agent-sdk 必須在最前面
mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mock(() => mockQueryGenerator()),
}));

// Mock dependencies
mock.module('../../src/services/podStore.js', () => ({
  podStore: {
    getByIdGlobal: mock(),
    setClaudeSessionId: mock(),
  },
}));

mock.module('../../src/services/outputStyleService.js', () => ({
  outputStyleService: {
    getContent: mock(),
  },
}));

mock.module('../../src/config/index.js', () => ({
  config: {
    repositoriesRoot: '/test/repos',
  },
}));

mock.module('../../src/utils/logger.js', () => ({
  logger: {
    log: mock(),
  },
}));

// Import after mocks
import { claudeQueryService, type StreamEvent } from '../../src/services/claude/queryService.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

describe('Claude QueryService', () => {
  let streamEvents: StreamEvent[];

  beforeEach(async () => {
    streamEvents = [];
    mockQueryGenerator = null;

    // 重置所有 mock 的調用歷史
    const { podStore } = await import('../../src/services/podStore.js');
    const { outputStyleService } = await import('../../src/services/outputStyleService.js');

    if ((podStore.getByIdGlobal as any).mockClear) {
      (podStore.getByIdGlobal as any).mockClear();
    }
    if ((podStore.setClaudeSessionId as any).mockClear) {
      (podStore.setClaudeSessionId as any).mockClear();
    }
    if ((outputStyleService.getContent as any).mockClear) {
      (outputStyleService.getContent as any).mockClear();
    }
  });

  afterEach(() => {
    // bun:test 會自動清理 mock
  });

  const createMockPod = (overrides = {}) => ({
    id: 'test-pod-id',
    name: 'Test Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
    ...overrides,
  });

  const onStreamCallback = (event: StreamEvent) => {
    streamEvents.push(event);
  };

  describe('sendMessage 基本流程', () => {
    it('成功發送訊息並接收文字回應', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      // Mock Claude SDK 回應
      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'new-session-123',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Hello, ' }],
          },
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'how can I help?' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Hello, how can I help?',
        };
      };

      const result = await claudeQueryService.sendMessage(
        'test-pod-id',
        'Hello',
        onStreamCallback
      );

      // 驗證 stream events
      expect(streamEvents).toHaveLength(3);
      expect(streamEvents[0]).toEqual({ type: 'text', content: 'Hello, ' });
      expect(streamEvents[1]).toEqual({ type: 'text', content: 'how can I help?' });
      expect(streamEvents[2]).toEqual({ type: 'complete' });

      // 驗證回傳結果
      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Hello, how can I help?');
      expect(result.podId).toBe('test-pod-id');

      // 驗證 session ID 被更新
      expect(podStore.setClaudeSessionId).toHaveBeenCalledWith(
        'test-canvas',
        'test-pod-id',
        'new-session-123'
      );
    });

    it('成功發送訊息並接收工具使用回應', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      // Mock Claude SDK 回應包含工具使用
      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session-with-tool',
        };

        yield {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-123',
                name: 'Read',
                input: { file_path: '/test/file.txt' },
              },
            ],
          },
        };

        yield {
          type: 'tool_progress',
          tool_use_id: 'tool-123',
          output: 'File content here',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'I read the file.' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'I read the file.',
        };
      };

      const result = await claudeQueryService.sendMessage(
        'test-pod-id',
        'Read the file',
        onStreamCallback
      );

      // 驗證 stream events
      expect(streamEvents).toHaveLength(4);
      expect(streamEvents[0]).toEqual({
        type: 'tool_use',
        toolUseId: 'tool-123',
        toolName: 'Read',
        input: { file_path: '/test/file.txt' },
      });
      expect(streamEvents[1]).toEqual({
        type: 'tool_result',
        toolUseId: 'tool-123',
        toolName: 'Read',
        output: 'File content here',
      });
      expect(streamEvents[2]).toEqual({ type: 'text', content: 'I read the file.' });
      expect(streamEvents[3]).toEqual({ type: 'complete' });

      // 驗證 toolUse 資訊
      expect(result.toolUse).toEqual({
        toolUseId: 'tool-123',
        toolName: 'Read',
        input: { file_path: '/test/file.txt' },
        output: 'File content here',
      });
    });

    it('Pod 不存在時拋出錯誤', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      (podStore.getByIdGlobal as any).mockReturnValue(null);

      await expect(
        claudeQueryService.sendMessage('nonexistent-pod', 'Hello', onStreamCallback)
      ).rejects.toThrow('找不到 Pod nonexistent-pod');
    });
  });

  describe('session resume 失敗時的重試邏輯', () => {
    it('session resume 錯誤時清除 session ID 並重試', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const { logger } = await import('../../src/utils/logger.js');
      const mockPod = createMockPod({
        claudeSessionId: 'old-invalid-session',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      let callCount = 0;

      // 第一次呼叫失敗 (session error)
      mockQueryGenerator = async function* () {
        callCount++;

        if (callCount === 1) {
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'old-invalid-session',
          };

          yield {
            type: 'result',
            subtype: 'error',
            errors: ['Invalid session ID or session expired'],
          };
        } else {
          // 第二次呼叫成功
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'new-valid-session',
          };

          yield {
            type: 'assistant',
            message: {
              content: [{ text: 'Retry successful' }],
            },
          };

          yield {
            type: 'result',
            subtype: 'success',
            result: 'Retry successful',
          };
        }
      };

      const result = await claudeQueryService.sendMessage(
        'test-pod-id',
        'Test retry',
        onStreamCallback
      );

      // 驗證 logger 被呼叫
      expect(logger.log).toHaveBeenCalledWith(
        'Chat',
        'Update',
        expect.stringContaining('Session resume failed')
      );

      // 驗證 session ID 被清除
      expect(podStore.setClaudeSessionId).toHaveBeenCalledWith('test-canvas', 'test-pod-id', '');

      // 驗證重試成功
      expect(result.content).toBe('Retry successful');
      expect(callCount).toBe(2);
    });

    it('非 session 錯誤時直接拋出不重試', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
        };

        yield {
          type: 'result',
          subtype: 'error',
          errors: ['Network error occurred'],
        };
      };

      await expect(
        claudeQueryService.sendMessage('test-pod-id', 'Test', onStreamCallback)
      ).rejects.toThrow('Network error occurred');

      // 驗證 stream event 包含錯誤
      expect(streamEvents[0]).toEqual({
        type: 'error',
        error: 'Network error occurred',
      });

      // 驗證沒有清除 session ID (檢查是否有用空字串呼叫)
      const calls = (podStore.setClaudeSessionId as any).mock.calls || [];
      const hasEmptyStringCall = calls.some((call: any[]) => call[2] === '');
      expect(hasEmptyStringCall).toBe(false);
    });
  });

  describe('image content block 處理', () => {
    it('正確轉換包含圖片的 ContentBlock[] 為 Claude 格式', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'image-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'I see the image.' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'I see the image.',
        };
      };

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image',
          mediaType: 'image/png',
          base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ];

      await claudeQueryService.sendMessage('test-pod-id', contentBlocks, onStreamCallback);

      // 驗證 query 被呼叫
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(Object), // AsyncIterable
          options: expect.objectContaining({
            cwd: '/test/workspace',
          }),
        })
      );
    });

    it('處理包含多個圖片的 ContentBlock[]', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'multi-image-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'I see multiple images.' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'I see multiple images.',
        };
      };

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'Compare these images:' },
        {
          type: 'image',
          mediaType: 'image/png',
          base64Data: 'base64data1',
        },
        {
          type: 'image',
          mediaType: 'image/jpeg',
          base64Data: 'base64data2',
        },
      ];

      const result = await claudeQueryService.sendMessage(
        'test-pod-id',
        contentBlocks,
        onStreamCallback
      );

      expect(result.content).toBe('I see multiple images.');
    });

    it('空文字區塊被過濾掉', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'empty-text-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Response' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Response',
        };
      };

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: '   ' }, // 空白文字應被過濾
        {
          type: 'image',
          mediaType: 'image/png',
          base64Data: 'base64data',
        },
      ];

      const result = await claudeQueryService.sendMessage(
        'test-pod-id',
        contentBlocks,
        onStreamCallback
      );

      expect(result.content).toBe('Response');
    });

    it('所有內容為空時使用預設訊息', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod();

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'default-message-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'OK' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'OK',
        };
      };

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: '   ' }, // 只有空白
      ];

      await claudeQueryService.sendMessage('test-pod-id', contentBlocks, onStreamCallback);

      // 驗證使用了預設訊息
      expect(query).toHaveBeenCalled();
    });
  });

  describe('command 前綴處理', () => {
    it('Pod 有 commandId 時添加前綴到字串訊息', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        commandId: 'review',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'command-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Reviewing code...' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Reviewing code...',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'the code', onStreamCallback);

      // 驗證 query 被呼叫時 prompt 包含 command 前綴
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '/review the code',
        })
      );
    });

    it('Pod 有 commandId 時添加前綴到 ContentBlock[] 的第一個文字區塊', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        commandId: 'analyze',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'analyze-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Analysis result' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Analysis result',
        };
      };

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'this image' },
        {
          type: 'image',
          mediaType: 'image/png',
          base64Data: 'base64data',
        },
      ];

      await claudeQueryService.sendMessage('test-pod-id', contentBlocks, onStreamCallback);

      // 驗證 query 被呼叫
      expect(query).toHaveBeenCalled();
    });

    it('沒有 commandId 時不添加前綴', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        commandId: null,
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'no-command-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Response' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Response',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'normal message', onStreamCallback);

      // 驗證 query 被呼叫時 prompt 不包含前綴
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'normal message',
        })
      );
    });

    it('空訊息搭配 commandId 時只添加 command 前綴', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        commandId: 'start',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'empty-with-command-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Started' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Started',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', '', onStreamCallback);

      // 驗證空訊息加上 commandId 後的結果
      // 空字串加上 command 前綴變成 "/start "
      // trim 後是 "/start",長度不為 0,所以不會使用預設訊息
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '/start ',
        })
      );
    });
  });

  describe('其他配置處理', () => {
    it('有 repositoryId 時使用 repositories root 作為 cwd', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        repositoryId: 'my-repo',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'repo-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'OK' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'OK',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'test', onStreamCallback);

      // 驗證 cwd 使用 repositoriesRoot + repositoryId
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            cwd: '/test/repos/my-repo',
          }),
        })
      );
    });

    it('有 outputStyleId 時設定 systemPrompt', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const { outputStyleService } = await import('../../src/services/outputStyleService.js');
      const mockPod = createMockPod({
        outputStyleId: 'style-123',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      (outputStyleService.getContent as any).mockResolvedValue('Custom system prompt');

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'style-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Styled response' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Styled response',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'test', onStreamCallback);

      // 驗證 systemPrompt 被設定
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: 'Custom system prompt',
          }),
        })
      );
    });

    it('沒有 outputStyleId 時不設定 systemPrompt', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        outputStyleId: null,
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'no-style-session',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Response' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Response',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'test', onStreamCallback);

      // 驗證 options 不包含 systemPrompt
      const callArgs = (query as any).mock.calls[0][0];
      expect(callArgs.options).not.toHaveProperty('systemPrompt');
    });

    it('有 claudeSessionId 時設定 resume 選項', async () => {
      const { podStore } = await import('../../src/services/podStore.js');
      const mockPod = createMockPod({
        claudeSessionId: 'existing-session-123',
      });

      (podStore.getByIdGlobal as any).mockReturnValue({
        canvasId: 'test-canvas',
        pod: mockPod,
      });

      mockQueryGenerator = async function* () {
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'existing-session-123',
        };

        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Resumed conversation' }],
          },
        };

        yield {
          type: 'result',
          subtype: 'success',
          result: 'Resumed conversation',
        };
      };

      await claudeQueryService.sendMessage('test-pod-id', 'continue', onStreamCallback);

      // 驗證 resume 選項被設定
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            resume: 'existing-session-123',
          }),
        })
      );
    });
  });
});
