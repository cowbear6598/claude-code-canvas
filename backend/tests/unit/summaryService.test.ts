import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';

// Import 真實模組
import { summaryService } from '../../src/services/summaryService.js';
import { commandService } from '../../src/services/commandService.js';
import { outputStyleService } from '../../src/services/outputStyleService.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { disposableChatService } from '../../src/services/claude/disposableChatService.js';
import { summaryPromptBuilder } from '../../src/services/summaryPromptBuilder.js';
import { logger } from '../../src/utils/logger.js';

describe('SummaryService', () => {
  const mockSourcePod = {
    id: 'source-pod',
    name: 'Source Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
  };

  const mockTargetPod = {
    id: 'target-pod',
    name: 'Target Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
  };

  const mockMessages = [
    {
      id: 'msg-1',
      podId: 'source-pod',
      role: 'user' as const,
      content: 'Hello',
      timestamp: Date.now(),
      toolUse: null,
    },
    {
      id: 'msg-2',
      podId: 'source-pod',
      role: 'assistant' as const,
      content: 'Hi there!',
      timestamp: Date.now(),
      toolUse: null,
    },
  ];

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

  beforeEach(() => {
    // 清空 spy 陣列
    spies = [];

    // commandService
    setupMock(commandService, 'getContent', { resolvedValue: null });

    // outputStyleService
    setupMock(outputStyleService, 'getContent', { resolvedValue: null });

    // podStore
    setupMock(podStore, 'getById', {
      implementation: (canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return mockTargetPod;
        return null;
      }
    });

    // messageStore
    setupMock(messageStore, 'getMessages', { returnValue: mockMessages });

    // disposableChatService
    setupMock(disposableChatService, 'executeDisposableChat', {
      resolvedValue: {
        success: true,
        content: 'Summary result',
      }
    });

    // summaryPromptBuilder
    setupMock(summaryPromptBuilder, 'formatConversationHistory', {
      returnValue: '[User]: Hello\n\n[Assistant]: Hi'
    });
    setupMock(summaryPromptBuilder, 'buildSystemPrompt', {
      returnValue: 'System prompt'
    });
    setupMock(summaryPromptBuilder, 'buildUserPrompt', {
      returnValue: 'User prompt'
    });

    // logger
    setupMock(logger, 'error', { implementation: () => {} });
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies = [];
  });

  describe('generateSummaryForTarget Command 讀取邏輯', () => {
    it('Target Pod 有 commandId 時，正確讀取 Command 內容', async () => {
      const targetPodWithCommand = {
        ...mockTargetPod,
        commandId: 'review-command',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return targetPodWithCommand;
        return null;
      });

      (commandService.getContent as any).mockResolvedValue('Review the code carefully.');

      await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'target-pod');

      expect(commandService.getContent).toHaveBeenCalledWith('review-command');
      expect(summaryPromptBuilder.buildUserPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPodCommand: 'Review the code carefully.',
        })
      );
    });

    it('Target Pod commandId 為 null 時，不讀取 Command', async () => {
      await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'target-pod');

      expect(commandService.getContent).not.toHaveBeenCalled();
      expect(summaryPromptBuilder.buildUserPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPodCommand: null,
        })
      );
    });

    it('commandService.getContent 回傳 null 時，降級處理', async () => {
      const targetPodWithCommand = {
        ...mockTargetPod,
        commandId: 'nonexistent-command',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return targetPodWithCommand;
        return null;
      });

      (commandService.getContent as any).mockResolvedValue(null);

      const result = await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'target-pod');

      expect(commandService.getContent).toHaveBeenCalledWith('nonexistent-command');
      expect(summaryPromptBuilder.buildUserPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPodCommand: null,
        })
      );
      expect(result.success).toBe(true);
    });

    it('正確傳遞 targetPodCommand 至 buildUserPrompt', async () => {
      const targetPodWithCommand = {
        ...mockTargetPod,
        commandId: 'analyze-command',
        outputStyleId: 'style-123',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return targetPodWithCommand;
        return null;
      });

      (commandService.getContent as any).mockResolvedValue('Analyze the performance.');
      (outputStyleService.getContent as any).mockResolvedValue('You are an analyst.');

      await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'target-pod');

      expect(summaryPromptBuilder.buildUserPrompt).toHaveBeenCalledWith({
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: 'You are an analyst.',
        targetPodCommand: 'Analyze the performance.',
        conversationHistory: '[User]: Hello\n\n[Assistant]: Hi',
      });
    });
  });

  describe('generateSummaryForTarget 錯誤處理', () => {
    it('Source Pod 不存在時回傳錯誤', async () => {
      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'target-pod') return mockTargetPod;
        return null;
      });

      const result = await summaryService.generateSummaryForTarget('canvas-1', 'nonexistent', 'target-pod');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source Pod nonexistent not found');
    });

    it('Target Pod 不存在時回傳錯誤', async () => {
      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        return null;
      });

      const result = await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target Pod nonexistent not found');
    });

    it('Source Pod 沒有訊息時回傳錯誤', async () => {
      (messageStore.getMessages as any).mockReturnValue([]);

      const result = await summaryService.generateSummaryForTarget('canvas-1', 'source-pod', 'target-pod');

      expect(result.success).toBe(false);
      expect(result.error).toContain('has no messages');
    });
  });
});
