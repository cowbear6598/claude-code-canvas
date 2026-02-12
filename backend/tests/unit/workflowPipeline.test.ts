// Mock dependencies
vi.mock('../../src/services/podStore.js', () => ({
  podStore: {
    getById: vi.fn(),
    setStatus: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workflowPipeline } from '../../src/services/workflow/workflowPipeline.js';
import { podStore } from '../../src/services/podStore.js';
import type { PipelineContext, TriggerStrategy, CollectSourcesContext, TriggerDecideContext } from '../../src/services/workflow/types.js';
import type { Connection } from '../../src/types/index.js';
import { createMockPod, createMockConnection, createMockStrategy, TEST_IDS } from '../mocks/workflowTestFactories.js';

describe('WorkflowPipeline', () => {
  const { canvasId, sourcePodId, targetPodId, connectionId } = TEST_IDS;

  const mockConnection: Connection = createMockConnection({
    id: connectionId,
    sourcePodId,
    targetPodId,
    triggerMode: 'auto',
  });

  const baseContext: PipelineContext = {
    canvasId,
    sourcePodId,
    connection: mockConnection,
    triggerMode: 'auto',
    decideResult: { connectionId, approved: true, reason: null },
  };

  const mockExecutionService = {
    generateSummaryWithFallback: vi.fn(),
    triggerWorkflowWithSummary: vi.fn(),
  };

  const mockStateService = {
    checkMultiInputScenario: vi.fn(),
  };

  const mockMultiInputService = {
    handleMultiInputForConnection: vi.fn(),
  };

  const mockQueueService = {
    enqueue: vi.fn(),
  };

  const mockTargetPod = createMockPod({
    id: targetPodId,
    name: 'Target Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    status: 'idle' as const,
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Initialize pipeline with mock services
    workflowPipeline.init(
      mockExecutionService,
      mockStateService,
      mockMultiInputService,
      mockQueueService
    );

    // Default mock returns
    (mockExecutionService.generateSummaryWithFallback as any).mockResolvedValue({
      content: '摘要',
      isSummarized: true,
    });
    (mockStateService.checkMultiInputScenario as any).mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });
    (podStore.getById as any).mockReturnValue(mockTargetPod);
  });

  describe('Pipeline 完整流程', () => {
    it('有 collectSources 的 strategy 時，完整執行 pipeline', async () => {
      const mockStrategy = createMockStrategy('auto', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
        }),
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 generateSummaryWithFallback 被呼叫
      expect(mockExecutionService.generateSummaryWithFallback).toHaveBeenCalledWith(
        canvasId,
        sourcePodId,
        targetPodId
      );

      // 驗證 strategy.collectSources 被呼叫
      expect(mockStrategy.collectSources).toHaveBeenCalledWith({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: '摘要',
      });

      // 驗證 triggerWorkflowWithSummary 被呼叫（沒有 mergedContent 時也走 triggerWorkflowWithSummary）
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '摘要',
        true,
        mockStrategy
      );
    });
  });

  describe('collectSources 階段', () => {
    it('collectSources 回傳 ready=false 時暫停', async () => {
      const mockStrategy = createMockStrategy('auto', {
        collectSources: vi.fn().mockResolvedValue({
          ready: false,
        }),
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 未被呼叫
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();

      // 驗證 queueService.enqueue 未被呼叫
      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('使用預設 collectSources 邏輯（strategy 沒有 collectSources）', async () => {
      const mockStrategy = createMockStrategy('auto');

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 stateService.checkMultiInputScenario 被呼叫
      expect(mockStateService.checkMultiInputScenario).toHaveBeenCalledWith(
        canvasId,
        targetPodId
      );

      // 驗證 triggerWorkflowWithSummary 被呼叫
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '摘要',
        true,
        mockStrategy
      );
    });

    it('多輸入情境正確委派', async () => {
      const mockStrategy = createMockStrategy('auto');

      (mockStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: true,
        requiredSourcePodIds: ['pod-a', 'pod-b'],
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 multiInputService.handleMultiInputForConnection 被呼叫
      expect(mockMultiInputService.handleMultiInputForConnection).toHaveBeenCalledWith(
        canvasId,
        sourcePodId,
        mockConnection,
        ['pod-a', 'pod-b'],
        '摘要',
        'auto'
      );

      // 驗證 triggerWorkflowWithSummary 未被呼叫（多輸入後 return）
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });

    it('collectSources 提供 mergedContent 時使用該內容', async () => {
      const mockStrategy = createMockStrategy('auto', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
          mergedContent: '合併內容',
          isSummarized: true,
        }),
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 被呼叫，第五個參數是 strategy 物件
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '合併內容',
        true,
        mockStrategy
      );

      // 驗證傳入的 summary 是 '合併內容'
      const call = (mockExecutionService.triggerWorkflowWithSummary as any).mock.calls[0];
      expect(call[2]).toBe('合併內容');
      expect(call[3]).toBe(true); // isSummarized
    });
  });

  describe('checkQueue 階段', () => {
    it('目標 Pod 忙碌時加入佇列', async () => {
      const mockStrategy = createMockStrategy('auto');

      (podStore.getById as any).mockReturnValue({
        ...mockTargetPod,
        status: 'chatting',
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 queueService.enqueue 被呼叫，傳入正確的 triggerMode
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        summary: '摘要',
        isSummarized: true,
        triggerMode: 'auto',
      });

      // 驗證 triggerWorkflowWithSummary 未被呼叫
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });
  });

  describe('generateSummary 階段', () => {
    it('generateSummary 失敗時不繼續流程', async () => {
      const mockStrategy = createMockStrategy('auto', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
        }),
      });

      (mockExecutionService.generateSummaryWithFallback as any).mockResolvedValue(null);

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 未被呼叫
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();

      // 驗證 collectSources 未被呼叫
      expect(mockStrategy.collectSources).not.toHaveBeenCalled();
    });
  });

  describe('collectSources 與 mergedContent 的完整流程', () => {
    it('collectSources 回傳 mergedContent 且 isSummarized 未設定時預設為 true', async () => {
      const mockStrategy = createMockStrategy('auto', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
          mergedContent: '合併內容但未指定 isSummarized',
        }),
      });

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 被呼叫時 isSummarized 預設為 true
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '合併內容但未指定 isSummarized',
        true, // isSummarized 預設為 true
        mockStrategy
      );
    });
  });

  describe('trigger 階段傳遞 strategy', () => {
    it('ai-decide mode 時傳遞 strategy 給 triggerWorkflowWithSummary', async () => {
      const aiDecideContext: PipelineContext = {
        ...baseContext,
        triggerMode: 'ai-decide',
        connection: createMockConnection({
          ...mockConnection,
          triggerMode: 'ai-decide',
        }),
      };

      const mockStrategy = createMockStrategy('ai-decide', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
          mergedContent: '合併內容',
          isSummarized: true,
        }),
      });

      await workflowPipeline.execute(aiDecideContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 被呼叫時第五個參數是 strategy
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '合併內容',
        true,
        mockStrategy
      );
    });

    it('direct mode 時傳遞 strategy 給 triggerWorkflowWithSummary', async () => {
      const directContext: PipelineContext = {
        ...baseContext,
        triggerMode: 'direct',
        connection: createMockConnection({
          ...mockConnection,
          triggerMode: 'direct',
        }),
      };

      const mockStrategy = createMockStrategy('direct', {
        collectSources: vi.fn().mockResolvedValue({
          ready: true,
          mergedContent: '合併內容',
          isSummarized: true,
        }),
      });

      await workflowPipeline.execute(directContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 被呼叫時第五個參數是 strategy
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        connectionId,
        '合併內容',
        true,
        mockStrategy
      );
    });
  });

  describe('目標 Pod 不存在時的處理', () => {
    it('找不到目標 Pod 時不觸發 workflow', async () => {
      const mockStrategy = createMockStrategy('auto');

      (podStore.getById as any).mockReturnValue(null);

      await workflowPipeline.execute(baseContext, mockStrategy);

      // 驗證 triggerWorkflowWithSummary 未被呼叫
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();

      // 驗證 queueService.enqueue 未被呼叫
      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });
  });
});
