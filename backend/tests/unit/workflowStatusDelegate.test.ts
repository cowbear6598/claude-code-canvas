vi.mock('../../src/services/podStore.js', () => ({
  podStore: {
    setStatus: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/runExecutionService.js', () => ({
  runExecutionService: {
    startPodInstance: vi.fn(),
    summarizingPodInstance: vi.fn(),
    decidingPodInstance: vi.fn(),
    waitingPodInstance: vi.fn(),
    settlePodTrigger: vi.fn(),
    errorPodInstance: vi.fn(),
    settleAndSkipPath: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowQueueService.js', () => ({
  workflowQueueService: {
    processNextInQueue: vi.fn().mockResolvedValue(undefined),
    init: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatusDelegate } from '../../src/services/workflow/workflowStatusDelegate.js';
import { podStore } from '../../src/services/podStore.js';
import { runExecutionService } from '../../src/services/workflow/runExecutionService.js';
import { createMockRunContext, TEST_IDS } from '../mocks/workflowTestFactories.js';

describe('WorkflowStatusDelegate', () => {
  const { canvasId, targetPodId } = TEST_IDS;
  const mockRunContext = createMockRunContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStatusDelegate 工廠函數', () => {
    it('無 runContext 時回傳 NormalModeDelegate（isRunMode=false）', () => {
      const delegate = createStatusDelegate();
      expect(delegate.isRunMode()).toBe(false);
    });

    it('有 runContext 時回傳 RunModeDelegate（isRunMode=true）', () => {
      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.isRunMode()).toBe(true);
    });
  });

  describe('NormalModeDelegate', () => {
    const delegate = createStatusDelegate();

    it('startPodExecution 呼叫 podStore.setStatus chatting', () => {
      delegate.startPodExecution(canvasId, targetPodId);
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'chatting');
    });

    it('markSummarizing 呼叫 podStore.setStatus summarizing', () => {
      delegate.markSummarizing(canvasId, targetPodId);
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'summarizing');
    });

    it('markDeciding 無操作', () => {
      delegate.markDeciding(canvasId, targetPodId);
      expect(podStore.setStatus).not.toHaveBeenCalled();
    });

    it('markWaiting 無操作', () => {
      delegate.markWaiting(canvasId, targetPodId);
      expect(podStore.setStatus).not.toHaveBeenCalled();
    });

    it('onSummaryComplete 呼叫 podStore.setStatus idle', () => {
      delegate.onSummaryComplete(canvasId, targetPodId, 'auto');
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'idle');
    });

    it('onSummaryFailed 呼叫 podStore.setStatus idle', () => {
      delegate.onSummaryFailed(canvasId, targetPodId, '生成失敗');
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'idle');
    });

    it('onChatComplete 無操作（由 strategy.onComplete 處理）', () => {
      delegate.onChatComplete(canvasId, targetPodId, 'auto');
      expect(podStore.setStatus).not.toHaveBeenCalled();
    });

    it('onChatError 呼叫 podStore.setStatus idle', () => {
      delegate.onChatError(canvasId, targetPodId, '執行失敗');
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'idle');
    });

    it('shouldEnqueue 回傳 true', () => {
      expect(delegate.shouldEnqueue()).toBe(true);
    });

    it('settleAndSkipPath 無操作', () => {
      delegate.settleAndSkipPath(canvasId, targetPodId, 'auto');
      expect(runExecutionService.settleAndSkipPath).not.toHaveBeenCalled();
    });

    it('scheduleNextInQueue 應呼叫 workflowQueueService.processNextInQueue', async () => {
      const { workflowQueueService } = await import('../../src/services/workflow/workflowQueueService.js');

      delegate.scheduleNextInQueue(canvasId, targetPodId);

      // 動態 import + fireAndForget 為非同步，需等待 microtask queue 清空
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(workflowQueueService.processNextInQueue).toHaveBeenCalledWith(canvasId, targetPodId);
    });
  });

  describe('RunModeDelegate', () => {
    const delegate = createStatusDelegate(mockRunContext);

    it('startPodExecution 呼叫 runExecutionService.startPodInstance', () => {
      delegate.startPodExecution(canvasId, targetPodId);
      expect(runExecutionService.startPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId);
    });

    it('markSummarizing 呼叫 runExecutionService.summarizingPodInstance', () => {
      delegate.markSummarizing(canvasId, targetPodId);
      expect(runExecutionService.summarizingPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId);
    });

    it('markDeciding 呼叫 runExecutionService.decidingPodInstance', () => {
      delegate.markDeciding(canvasId, targetPodId);
      expect(runExecutionService.decidingPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId);
    });

    it('markWaiting 呼叫 runExecutionService.waitingPodInstance', () => {
      delegate.markWaiting(canvasId, targetPodId);
      expect(runExecutionService.waitingPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId);
    });

    it('onSummaryComplete 帶 pathway 時呼叫 runExecutionService.settlePodTrigger', () => {
      delegate.onSummaryComplete(canvasId, targetPodId, 'auto');
      expect(runExecutionService.settlePodTrigger).toHaveBeenCalledWith(mockRunContext, targetPodId, 'auto');
    });

    it('onSummaryComplete 無 pathway 時不呼叫 settlePodTrigger', () => {
      delegate.onSummaryComplete(canvasId, targetPodId);
      expect(runExecutionService.settlePodTrigger).not.toHaveBeenCalled();
    });

    it('onSummaryFailed 呼叫 runExecutionService.errorPodInstance', () => {
      delegate.onSummaryFailed(canvasId, targetPodId, '生成失敗');
      expect(runExecutionService.errorPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId, '生成失敗');
    });

    it('onChatComplete 呼叫 runExecutionService.settlePodTrigger', () => {
      delegate.onChatComplete(canvasId, targetPodId, 'direct');
      expect(runExecutionService.settlePodTrigger).toHaveBeenCalledWith(mockRunContext, targetPodId, 'direct');
    });

    it('onChatError 呼叫 runExecutionService.errorPodInstance', () => {
      delegate.onChatError(canvasId, targetPodId, '執行失敗');
      expect(runExecutionService.errorPodInstance).toHaveBeenCalledWith(mockRunContext, targetPodId, '執行失敗');
    });

    it('shouldEnqueue 回傳 false', () => {
      expect(delegate.shouldEnqueue()).toBe(false);
    });

    it('scheduleNextInQueue 無操作（run mode 無佇列）', () => {
      delegate.scheduleNextInQueue(canvasId, targetPodId);
      // run mode 下不應觸發任何佇列操作
      expect(podStore.setStatus).not.toHaveBeenCalled();
    });

    it('settleAndSkipPath 呼叫 runExecutionService.settleAndSkipPath', () => {
      delegate.settleAndSkipPath(canvasId, targetPodId, 'auto');
      expect(runExecutionService.settleAndSkipPath).toHaveBeenCalledWith(mockRunContext, targetPodId, 'auto');
    });
  });
});
