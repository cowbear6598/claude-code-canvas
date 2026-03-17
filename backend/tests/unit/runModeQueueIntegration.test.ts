vi.mock('../../src/services/runStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/runStore.js')>();
  return {
    ...actual,
    runStore: {
      getPodInstance: vi.fn(),
      settleAutoPathway: vi.fn(),
      settleDirectPathway: vi.fn(),
      updatePodInstanceStatus: vi.fn(),
      getPodInstancesByRunId: vi.fn().mockReturnValue([]),
    },
  };
});

vi.mock('../../src/services/workflow/runExecutionService.js', () => ({
  runExecutionService: {
    startPodInstance: vi.fn(),
    summarizingPodInstance: vi.fn(),
    decidingPodInstance: vi.fn(),
    waitingPodInstance: vi.fn(),
    settlePodTrigger: vi.fn(),
    errorPodInstance: vi.fn(),
    settleAndSkipPath: vi.fn(),
    queuedPodInstance: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/runQueueService.js', () => ({
  runQueueService: {
    processNext: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn(),
    getQueueSize: vi.fn().mockReturnValue(0),
    init: vi.fn(),
  },
}));

vi.mock('../../src/services/podStore.js', () => ({
  podStore: {
    setStatus: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatusDelegate } from '../../src/services/workflow/workflowStatusDelegate.js';
import { runStore } from '../../src/services/runStore.js';
import { createMockRunContext, createMockRunPodInstance, TEST_IDS } from '../mocks/workflowTestFactories.js';

const { canvasId, targetPodId } = TEST_IDS;
const mockRunContext = createMockRunContext();

describe('RunModeDelegate 佇列整合', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldEnqueue', () => {
    it('RunModeDelegate.shouldEnqueue 回傳 true', () => {
      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.shouldEnqueue()).toBe(true);
    });
  });

  describe('isBusy', () => {
    it('instance 狀態為 running 時 isBusy 回傳 true', () => {
      const instance = createMockRunPodInstance({ status: 'running' });
      (runStore.getPodInstance as any).mockReturnValue(instance);

      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(true);
    });

    it('instance 狀態為 pending 時 isBusy 回傳 false', () => {
      const instance = createMockRunPodInstance({ status: 'pending' });
      (runStore.getPodInstance as any).mockReturnValue(instance);

      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('instance 狀態為 queued 時 isBusy 回傳 false', () => {
      const instance = createMockRunPodInstance({ status: 'queued' });
      (runStore.getPodInstance as any).mockReturnValue(instance);

      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });

    it('instance 不存在時 isBusy 回傳 false', () => {
      (runStore.getPodInstance as any).mockReturnValue(undefined);

      const delegate = createStatusDelegate(mockRunContext);
      expect(delegate.isBusy(canvasId, targetPodId)).toBe(false);
    });
  });

  describe('scheduleNextInQueue', () => {
    it('呼叫 runQueueService.processNext', async () => {
      const { runQueueService } = await import('../../src/services/workflow/runQueueService.js');

      const delegate = createStatusDelegate(mockRunContext);
      delegate.scheduleNextInQueue(canvasId, targetPodId);

      // 動態 import + fireAndForget 為非同步，需等待 microtask queue 清空
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(runQueueService.processNext).toHaveBeenCalledWith(canvasId, targetPodId, mockRunContext);
    });
  });

});
