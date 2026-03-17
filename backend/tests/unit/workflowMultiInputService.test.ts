import {
  createPodStoreMock,
  createPendingTargetStoreMock,
  createLoggerMock,
  createSocketServiceMock,
  createRunStoreMock,
} from '../mocks/workflowModuleMocks.js';

const { mockRunQueueServiceEnqueue, mockCreateStatusDelegate } = vi.hoisted(() => ({
  mockRunQueueServiceEnqueue: vi.fn(),
  mockCreateStatusDelegate: vi.fn(),
}));

vi.mock('../../src/services/podStore.js', () => createPodStoreMock());
vi.mock('../../src/services/pendingTargetStore.js', () => createPendingTargetStoreMock());
vi.mock('../../src/utils/logger.js', () => createLoggerMock());
vi.mock('../../src/services/socketService.js', () => createSocketServiceMock());
vi.mock('../../src/services/runStore.js', () => createRunStoreMock());
vi.mock('../../src/services/workflow/workflowQueueService.js', () => ({
  workflowQueueService: {
    enqueue: vi.fn(),
    init: vi.fn(),
  },
}));
vi.mock('../../src/services/workflow/runQueueService.js', () => ({
  runQueueService: {
    enqueue: mockRunQueueServiceEnqueue,
    init: vi.fn(),
  },
}));
vi.mock('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    emitPendingStatus: vi.fn(),
  },
}));
vi.mock('../../src/services/workflow/workflowStatusDelegate.js', () => ({
  createStatusDelegate: mockCreateStatusDelegate,
}));

import { workflowMultiInputService } from '../../src/services/workflow/workflowMultiInputService.js';
import { podStore } from '../../src/services/podStore.js';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { workflowQueueService } from '../../src/services/workflow/workflowQueueService.js';
import { runStore } from '../../src/services/runStore.js';
import {
  createMockConnection,
  createMockPod,
  createMockStrategy,
  createMockRunContext,
  createMockRunPodInstance,
  TEST_IDS,
} from '../mocks/workflowTestFactories.js';
import type { TriggerStrategy } from '../../src/services/workflow/types.js';
import type { WorkflowStatusDelegate } from '../../src/services/workflow/workflowStatusDelegate.js';

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
  let mockDelegate: WorkflowStatusDelegate;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAutoStrategy = createMockStrategy('auto');
    mockExecutionService = {
      triggerWorkflowWithSummary: vi.fn().mockResolvedValue(undefined),
    };
    mockDelegate = { scheduleNextInQueue: vi.fn() } as unknown as WorkflowStatusDelegate;
    mockCreateStatusDelegate.mockReturnValue(mockDelegate);

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

    (runStore.getPodInstance as any).mockReturnValue(undefined);

    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);
    (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
      allSourcesResponded: true,
      hasRejection: false,
    });
    (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(
      new Map([[sourcePodId, 'Summary content']])
    );
  });

  describe('Normal Mode - target pod 忙碌時', () => {
    it('target pod 忙碌時應加入 workflowQueue', async () => {
      (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
        createMockPod({ id: podId, name: `Pod ${podId}`, status: 'chatting' })
      );

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
      });

      expect(workflowQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: mockConnection.id,
          targetPodId,
          isSummarized: true,
          triggerMode: 'auto',
        })
      );
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });

    it('target pod 閒置時不進入 queue 直接觸發', async () => {
      (podStore.getById as any).mockImplementation((_canvasId: string, podId: string) =>
        createMockPod({ id: podId, name: `Pod ${podId}`, status: 'idle' })
      );

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
      });

      expect(workflowQueueService.enqueue).not.toHaveBeenCalled();
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalled();
    });
  });

  describe('Run Mode - target pod instance 忙碌時', () => {
    it('target pod instance 為 running 時應加入 runQueue', async () => {
      const runContext = createMockRunContext();
      (runStore.getPodInstance as any).mockReturnValue(
        createMockRunPodInstance({ status: 'running' })
      );

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
        runContext,
      });

      await vi.waitFor(() => {
        expect(mockRunQueueServiceEnqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            canvasId,
            connectionId: mockConnection.id,
            targetPodId,
            isSummarized: true,
            triggerMode: 'auto',
            runContext,
          })
        );
      });
      expect(mockExecutionService.triggerWorkflowWithSummary).not.toHaveBeenCalled();
    });

    it('target pod instance 不是 running 時直接觸發，不加入 runQueue', async () => {
      const runContext = createMockRunContext();
      (runStore.getPodInstance as any).mockReturnValue(
        createMockRunPodInstance({ status: 'pending' })
      );

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
        runContext,
      });

      expect(mockRunQueueServiceEnqueue).not.toHaveBeenCalled();
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalled();
    });

    it('target pod instance 不存在時直接觸發，不加入 runQueue', async () => {
      const runContext = createMockRunContext();
      (runStore.getPodInstance as any).mockReturnValue(undefined);

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
        runContext,
      });

      expect(mockRunQueueServiceEnqueue).not.toHaveBeenCalled();
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalled();
    });
  });

  describe('handleMultiInputForConnection - 所有來源回應完畢有拒絕時', () => {
    it('所有來源回應完畢且有拒絕時不應觸發 workflow', async () => {
      (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: true,
      });

      await workflowMultiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection: mockConnection,
        summary: 'Some summary',
        triggerMode: 'auto',
      });

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
    it('Normal Mode：合併多來源 summary 後觸發下游 workflow 並傳入 delegate', () => {
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
        expect.objectContaining({
          canvasId,
          connectionId: mockConnection.id,
          summary: expect.stringContaining('First source summary'),
          isSummarized: true,
          participatingConnectionIds: undefined,
          strategy: mockAutoStrategy,
          delegate: mockDelegate,
        })
      );
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, targetPodId, 'chatting');
      expect(pendingTargetStore.clearPendingTarget).toHaveBeenCalledWith(targetPodId);
    });

    it('Run Mode：觸發下游 workflow 時傳入 Run Mode delegate', () => {
      const runContext = createMockRunContext();
      const summaries = new Map([[sourcePodId, 'Run mode summary']]);

      (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(summaries);
      (runStore.getPodInstance as any).mockReturnValue(
        createMockRunPodInstance({ status: 'pending' })
      );

      workflowMultiInputService.triggerMergedWorkflow(canvasId, mockConnection, 'auto', runContext);

      expect(mockCreateStatusDelegate).toHaveBeenCalledWith(runContext);
      expect(mockExecutionService.triggerWorkflowWithSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: mockConnection.id,
          isSummarized: true,
          strategy: mockAutoStrategy,
          runContext,
          delegate: mockDelegate,
        })
      );
      expect(podStore.setStatus).not.toHaveBeenCalled();
    });
  });
});
