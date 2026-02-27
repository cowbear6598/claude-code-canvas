import {
  createPodStoreMock,
  createPendingTargetStoreMock,
  createLoggerMock,
  createSocketServiceMock,
  createAutoClearServiceMock,
} from '../mocks/workflowModuleMocks.js';

vi.mock('../../src/services/podStore.js', () => createPodStoreMock());
vi.mock('../../src/services/pendingTargetStore.js', () => createPendingTargetStoreMock());
vi.mock('../../src/utils/logger.js', () => createLoggerMock());
vi.mock('../../src/services/socketService.js', () => createSocketServiceMock());
vi.mock('../../src/services/autoClear/autoClearService.js', () => createAutoClearServiceMock());
vi.mock('../../src/services/workflow/workflowQueueService.js', () => ({
  workflowQueueService: {
    enqueue: vi.fn(),
    init: vi.fn(),
  },
}));
vi.mock('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    emitPendingStatus: vi.fn(),
  },
}));

import { workflowMultiInputService } from '../../src/services/workflow/workflowMultiInputService.js';
import { podStore } from '../../src/services/podStore.js';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { workflowQueueService } from '../../src/services/workflow/workflowQueueService.js';
import { autoClearService } from '../../src/services/autoClear/autoClearService.js';
import { createMockConnection, createMockPod, createMockStrategy, TEST_IDS } from '../mocks/workflowTestFactories.js';
import type { TriggerStrategy } from '../../src/services/workflow/types.js';

describe('WorkflowMultiInputService', () => {
  const { canvasId, sourcePodId, targetPodId } = TEST_IDS;

  const mockConnection = createMockConnection({
    id: 'conn-multi-1',
    sourcePodId,
    targetPodId,
    triggerMode: 'auto',
  });

  let mockAutoStrategy: TriggerStrategy;
  let mockExecutionService: { triggerWorkflowWithSummary: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAutoStrategy = createMockStrategy('auto');
    mockExecutionService = {
      triggerWorkflowWithSummary: vi.fn().mockResolvedValue(undefined),
    };

    workflowMultiInputService.init({
      executionService: mockExecutionService as any,
      strategies: {
        auto: mockAutoStrategy,
        direct: createMockStrategy('direct'),
        'ai-decide': createMockStrategy('ai-decide'),
      },
    });

    (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
      createMockPod({ id: podId, name: `Pod ${podId}`, status: 'idle' })
    );

    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);
    (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
      allSourcesResponded: true,
      hasRejection: false,
    });
    (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(
      new Map([[sourcePodId, 'Summary content']])
    );
  });

  describe('handleMultiInputForConnection - target pod 忙碌時', () => {
    it('target pod 忙碌時應進入 queue（enqueueIfBusy 路徑）', async () => {
      (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
        createMockPod({ id: podId, name: `Pod ${podId}`, status: 'chatting' })
      );

      await workflowMultiInputService.handleMultiInputForConnection(
        canvasId,
        sourcePodId,
        mockConnection,
        [sourcePodId],
        'Some summary',
        'auto'
      );

      expect(workflowQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: mockConnection.id,
          targetPodId,
          isSummarized: true,
          triggerMode: 'auto',
        })
      );
    });

    it('target pod 閒置時不進入 queue', async () => {
      (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
        createMockPod({ id: podId, name: `Pod ${podId}`, status: 'idle' })
      );

      await workflowMultiInputService.handleMultiInputForConnection(
        canvasId,
        sourcePodId,
        mockConnection,
        [sourcePodId],
        'Some summary',
        'auto'
      );

      expect(workflowQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('handleMultiInputForConnection - 所有來源回應完畢有拒絕時', () => {
    it('所有來源回應完畢且有拒絕時應呼叫 onGroupNotTriggered', async () => {
      (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: true,
      });

      await workflowMultiInputService.handleMultiInputForConnection(
        canvasId,
        sourcePodId,
        mockConnection,
        [sourcePodId],
        'Some summary',
        'auto'
      );

      expect(autoClearService.onGroupNotTriggered).toHaveBeenCalledWith(canvasId, targetPodId);
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });
  });

  describe('triggerMergedWorkflow - completedSummaries 為 null', () => {
    it('completedSummaries 為 null 時直接 return 不觸發 workflow', () => {
      (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(null);

      workflowMultiInputService.triggerMergedWorkflow(canvasId, mockConnection, 'auto');

      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });
  });

  describe('triggerMergedWorkflow - 合併多來源 summary 觸發下游', () => {
    it('合併多來源 summary 後觸發下游 workflow', () => {
      const summaries = new Map([
        [sourcePodId, 'First source summary'],
        ['source-pod-2', 'Second source summary'],
      ]);

      (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(summaries);
      (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
        createMockPod({ id: podId, name: `Pod ${podId}`, status: 'idle' })
      );

      workflowMultiInputService.triggerMergedWorkflow(canvasId, mockConnection, 'auto');

      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        canvasId,
        mockConnection.id,
        expect.stringContaining('First source summary'),
        true,
        undefined,
        mockAutoStrategy
      );

      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'chatting');
      expect(pendingTargetStore.clearPendingTarget).toHaveBeenCalledWith(targetPodId);
    });
  });
});
