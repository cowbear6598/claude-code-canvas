import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock dependencies
mock.module('../../src/services/commandService.js', () => ({
  commandService: {
    getContent: mock(),
  },
}));

mock.module('../../src/services/outputStyleService.js', () => ({
  outputStyleService: {
    getContent: mock(),
  },
}));

mock.module('../../src/services/podStore.js', () => ({
  podStore: {
    getById: mock(),
  },
}));

mock.module('../../src/services/messageStore.js', () => ({
  messageStore: {
    getMessages: mock(),
  },
}));

mock.module('../../src/services/claude/disposableChatService.js', () => ({
  disposableChatService: {
    executeDisposableChat: mock(),
  },
}));

mock.module('../../src/services/summaryPromptBuilder.js', () => ({
  summaryPromptBuilder: {
    formatConversationHistory: mock(() => '[User]: Hello\n\n[Assistant]: Hi'),
    buildSystemPrompt: mock(() => 'System prompt'),
    buildUserPrompt: mock(() => 'User prompt'),
  },
}));

mock.module('../../src/utils/logger.js', () => ({
  logger: {
    error: mock(),
  },
}));

// Import after mocks
import { summaryService } from '../../src/services/summaryService.js';
import { commandService } from '../../src/services/commandService.js';
import { outputStyleService } from '../../src/services/outputStyleService.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { disposableChatService } from '../../src/services/claude/disposableChatService.js';
import { summaryPromptBuilder } from '../../src/services/summaryPromptBuilder.js';

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

  beforeEach(() => {
    // Reset all mocks
    (commandService.getContent as any).mockClear?.();
    (outputStyleService.getContent as any).mockClear?.();
    (podStore.getById as any).mockClear?.();
    (messageStore.getMessages as any).mockClear?.();
    (disposableChatService.executeDisposableChat as any).mockClear?.();
    (summaryPromptBuilder.formatConversationHistory as any).mockClear?.();
    (summaryPromptBuilder.buildSystemPrompt as any).mockClear?.();
    (summaryPromptBuilder.buildUserPrompt as any).mockClear?.();

    // Default mock returns
    (commandService.getContent as any).mockResolvedValue(null);
    (outputStyleService.getContent as any).mockResolvedValue(null);
    (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
      if (podId === 'source-pod') return mockSourcePod;
      if (podId === 'target-pod') return mockTargetPod;
      return null;
    });
    (messageStore.getMessages as any).mockReturnValue(mockMessages);
    (disposableChatService.executeDisposableChat as any).mockResolvedValue({
      success: true,
      content: 'Summary result',
    });
    (summaryPromptBuilder.formatConversationHistory as any).mockReturnValue('[User]: Hello\n\n[Assistant]: Hi');
    (summaryPromptBuilder.buildSystemPrompt as any).mockReturnValue('System prompt');
    (summaryPromptBuilder.buildUserPrompt as any).mockReturnValue('User prompt');
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
