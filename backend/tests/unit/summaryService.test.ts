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

  beforeEach(() => {
    // commandService
    vi.spyOn(commandService, 'getContent').mockResolvedValue(null);

    // outputStyleService
    vi.spyOn(outputStyleService, 'getContent').mockResolvedValue(null);

    // podStore
    vi.spyOn(podStore, 'getById').mockImplementation((canvasId: string, podId: string) => {
      if (podId === 'source-pod') return mockSourcePod;
      if (podId === 'target-pod') return mockTargetPod;
      return null;
    });

    // messageStore
    vi.spyOn(messageStore, 'getMessages').mockReturnValue(mockMessages);

    // disposableChatService
    vi.spyOn(disposableChatService, 'executeDisposableChat').mockResolvedValue({
      success: true,
      content: 'Summary result',
    });

    // summaryPromptBuilder
    vi.spyOn(summaryPromptBuilder, 'formatConversationHistory').mockReturnValue('[User]: Hello\n\n[Assistant]: Hi');
    vi.spyOn(summaryPromptBuilder, 'buildSystemPrompt').mockReturnValue('System prompt');
    vi.spyOn(summaryPromptBuilder, 'buildUserPrompt').mockReturnValue('User prompt');

    // logger
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
