vi.mock('../../src/services/podStore.js', () => ({
  podStore: {
    setStatus: vi.fn(),
    getById: vi.fn(),
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
    enqueue: vi.fn(),
    init: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/runQueueService.js', () => ({
  runQueueService: {
    processNext: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn(),
    init: vi.fn(),
  },
}));

vi.mock('../../src/services/runStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/runStore.js')>();
  return {
    ...actual,
    runStore: {
      getPodInstance: vi.fn(),
    },
  };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatusDelegate } from '../../src/services/workflow/workflowStatusDelegate.js';
import { podStore } from '../../src/services/podStore.js';
import { runExecutionService } from '../../src/services/workflow/runExecutionService.js';
import { runStore } from '../../src/services/runStore.js';
import { createMockRunContext, createMockRunPodInstance, TEST_IDS } from '../mocks/workflowTestFactories.js';

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

    it('isBusy Pod 為 idle 時回傳 false', () => {
      (podStore.getById as any).mockReturnValue({ status: 'idle' });
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('isBusy Pod 為 chatting 時回傳 true', () => {
      (podStore.getById as any).mockReturnValue({ status: 'chatting' });
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(true);
    });

    it('isBusy Pod 不存在時回傳 false', () => {
      (podStore.getById as any).mockReturnValue(undefined);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('enqueue 呼叫 workflowQueueService.enqueue', async () => {
      const { workflowQueueService } = await import('../../src/services/workflow/workflowQueueService.js');

      delegate.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-pod',
        targetPodId,
        summary: '摘要',
        isSummarized: true,
        triggerMode: 'auto',
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(workflowQueueService.enqueue).toHaveBeenCalled();
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

    it('shouldEnqueue 回傳 true', () => {
      expect(delegate.shouldEnqueue()).toBe(true);
    });

    it('isBusy instance 狀態為 running 時回傳 true', () => {
      (runStore.getPodInstance as any).mockReturnValue(createMockRunPodInstance({ status: 'running' }));
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(true);
    });

    it('isBusy instance 狀態為 pending 時回傳 false', () => {
      (runStore.getPodInstance as any).mockReturnValue(createMockRunPodInstance({ status: 'pending' }));
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('isBusy instance 不存在時回傳 false', () => {
      (runStore.getPodInstance as any).mockReturnValue(undefined);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('enqueue 呼叫 runQueueService.enqueue', async () => {
      const { runQueueService } = await import('../../src/services/workflow/runQueueService.js');

      delegate.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-pod',
        targetPodId,
        summary: '摘要',
        isSummarized: true,
        triggerMode: 'auto',
        runContext: mockRunContext,
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(runQueueService.enqueue).toHaveBeenCalled();
    });

    it('scheduleNextInQueue 呼叫 runQueueService.processNext', async () => {
      const { runQueueService } = await import('../../src/services/workflow/runQueueService.js');

      delegate.scheduleNextInQueue(canvasId, targetPodId);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(runQueueService.processNext).toHaveBeenCalledWith(canvasId, targetPodId, mockRunContext);
    });

    it('settleAndSkipPath 呼叫 runExecutionService.settleAndSkipPath', () => {
      delegate.settleAndSkipPath(canvasId, targetPodId, 'auto');
      expect(runExecutionService.settleAndSkipPath).toHaveBeenCalledWith(mockRunContext, targetPodId, 'auto');
    });
  });
});
