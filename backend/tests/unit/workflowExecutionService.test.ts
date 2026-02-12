// Mock dependencies
vi.mock('../../src/services/connectionStore.js', () => ({
  connectionStore: {
    findBySourcePodId: vi.fn(),
    getById: vi.fn(),
    updateDecideStatus: vi.fn(),
    updateConnectionStatus: vi.fn(),
  },
}));

vi.mock('../../src/services/podStore.js', () => ({
  podStore: {
    getById: vi.fn(),
    setStatus: vi.fn(),
  },
}));

vi.mock('../../src/services/messageStore.js', () => ({
  messageStore: {
    getMessages: vi.fn(),
    upsertMessage: vi.fn(),
    flushWrites: vi.fn(),
  },
}));

vi.mock('../../src/services/summaryService.js', () => ({
  summaryService: {
    generateSummaryForTarget: vi.fn(),
  },
}));

vi.mock('../../src/services/pendingTargetStore.js', () => ({
  pendingTargetStore: {
    hasPendingTarget: vi.fn(),
    getPendingTarget: vi.fn(),
    clearPendingTarget: vi.fn(),
    initializePendingTarget: vi.fn(),
    recordSourceCompletion: vi.fn(),
    recordSourceRejection: vi.fn(),
    getCompletedSummaries: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    checkMultiInputScenario: vi.fn(),
    emitPendingStatus: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowEventEmitter.js', () => ({
  workflowEventEmitter: {
    emitWorkflowAutoTriggered: vi.fn(),
    emitAiDecidePending: vi.fn(),
    emitAiDecideResult: vi.fn(),
    emitAiDecideError: vi.fn(),
    emitWorkflowQueued: vi.fn(),
    emitWorkflowComplete: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/aiDecideService.js', () => ({
  aiDecideService: {
    decideConnections: vi.fn(),
  },
}));

vi.mock('../../src/services/autoClear/index.js', () => ({
  autoClearService: {
    initializeWorkflowTracking: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/socketService.js', () => ({
  socketService: {
    emitToCanvas: vi.fn(),
  },
}));

vi.mock('../../src/services/claude/queryService.js', () => ({
  claudeQueryService: {
    executeChatInPod: vi.fn(),
    sendMessage: vi.fn(async () => {}),
  },
}));

vi.mock('../../src/services/commandService.js', () => ({
  commandService: {
    getContent: vi.fn(),
    list: vi.fn(async () => []),
  },
}));

vi.mock('../../src/services/workflow/workflowMultiInputService.js', () => ({
  workflowMultiInputService: {
    handleMultiInputForConnection: vi.fn(),
    init: vi.fn(),
  },
}));

vi.mock('../../src/services/directTriggerStore.js', () => ({
  directTriggerStore: {
    hasDirectPending: vi.fn(),
    initializeDirectPending: vi.fn(),
    recordDirectReady: vi.fn(),
    clearDirectPending: vi.fn(),
    hasActiveTimer: vi.fn(),
    clearTimer: vi.fn(),
    setTimer: vi.fn(),
    getReadySummaries: vi.fn(),
  },
}));

// Import after mocks
import { workflowExecutionService } from '../../src/services/workflow';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { summaryService } from '../../src/services/summaryService.js';
import { workflowStateService } from '../../src/services/workflow';
import { workflowEventEmitter } from '../../src/services/workflow';
import { aiDecideService } from '../../src/services/workflow';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { workflowQueueService } from '../../src/services/workflow';
import { workflowMultiInputService } from '../../src/services/workflow';
import type { Connection, TriggerMode } from '../../src/types';
import type { TriggerStrategy } from '../../src/services/workflow/types.js';

describe('WorkflowExecutionService', () => {
  const canvasId = 'canvas-1';
  const sourcePodId = 'source-pod';
  const targetPodId = 'target-pod';

  // Strategy mocks
  const mockAutoStrategy: TriggerStrategy = {
    mode: 'auto' as const,
    decide: vi.fn().mockResolvedValue([]),
    onTrigger: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onQueued: vi.fn(),
    onQueueProcessed: vi.fn(),
  };

  const mockDirectStrategy: TriggerStrategy = {
    mode: 'direct' as const,
    decide: vi.fn().mockResolvedValue([]),
    collectSources: vi.fn(),
    onTrigger: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onQueued: vi.fn(),
    onQueueProcessed: vi.fn(),
  };

  const mockAiDecideStrategy: TriggerStrategy = {
    mode: 'ai-decide' as const,
    decide: vi.fn().mockResolvedValue([]),
    onTrigger: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onQueued: vi.fn(),
    onQueueProcessed: vi.fn(),
  };

  const mockSourcePod = {
    id: sourcePodId,
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
    id: targetPodId,
    name: 'Target Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
  };

  const mockAutoConnection: Connection = {
    id: 'conn-auto-1',
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    triggerMode: 'auto',
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    createdAt: new Date(),
  };

  const mockAiDecideConnection: Connection = {
    id: 'conn-ai-1',
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId: 'target-pod-2',
    targetAnchor: 'left',
    triggerMode: 'ai-decide',
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    createdAt: new Date(),
  };

  const mockMessages = [
    {
      id: 'msg-1',
      podId: sourcePodId,
      role: 'user' as const,
      content: 'Test message',
      timestamp: Date.now(),
      toolUse: null,
    },
    {
      id: 'msg-2',
      podId: sourcePodId,
      role: 'assistant' as const,
      content: 'Test response',
      timestamp: Date.now(),
      toolUse: null,
    },
  ];

  // Mock Pipeline - 模擬實際執行摘要生成
  const mockPipeline = {
    execute: vi.fn().mockImplementation(async (context: any, strategy: TriggerStrategy) => {
      // 模擬 pipeline 的行為：生成摘要
      const summaryResult = await summaryService.generateSummaryForTarget(
        context.canvasId,
        context.sourcePodId,
        context.connection.targetPodId
      );

      // 檢查是否為多輸入場景
      const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
        context.canvasId,
        context.connection.targetPodId
      );

      if (isMultiInput) {
        // 呼叫 multiInputService
        await workflowMultiInputService.handleMultiInputForConnection(
          context.canvasId,
          context.sourcePodId,
          context.connection,
          requiredSourcePodIds,
          summaryResult.summary || 'test summary',
          context.triggerMode
        );
        return;
      }

      // 檢查 target pod 狀態
      const targetPod = podStore.getById(context.canvasId, context.connection.targetPodId);
      if (targetPod && targetPod.status !== 'idle') {
        // 加入 queue
        workflowQueueService.enqueue({
          canvasId: context.canvasId,
          connectionId: context.connection.id,
          sourcePodId: context.sourcePodId,
          targetPodId: context.connection.targetPodId,
          summary: summaryResult.summary || 'test summary',
          isSummarized: summaryResult.success || false,
          triggerMode: context.triggerMode,
        });
        return;
      }

      // 觸發 workflow
      await workflowExecutionService.triggerWorkflowWithSummary(
        context.canvasId,
        context.connection.id,
        summaryResult.summary || 'test summary',
        summaryResult.success || false,
        strategy
      );
    }),
    init: vi.fn(),
  };

  // Mock Auto Trigger Service - 模擬實際呼叫 pipeline
  const mockAutoTriggerService = {
    processAutoTriggerConnection: vi.fn().mockImplementation(async (canvasId: string, sourcePodId: string, connection: Connection) => {
      const pipelineContext = {
        canvasId,
        sourcePodId,
        connection,
        triggerMode: 'auto' as const,
        decideResult: { connectionId: connection.id, approved: true, reason: null },
      };
      await mockPipeline.execute(pipelineContext, mockAutoStrategy);
    }),
    init: vi.fn(),
  };

  // Mock AI Decide Trigger Service - 模擬實際執行 AI decide 流程
  const mockAiDecideTriggerService = {
    processAiDecideConnections: vi.fn().mockImplementation(async (canvasId: string, sourcePodId: string, connections: Connection[]) => {
      // 發送 pending 事件
      workflowEventEmitter.emitAiDecidePending(
        canvasId,
        connections.map(c => c.id),
        sourcePodId
      );

      // 更新狀態為 pending
      connections.forEach(conn => {
        connectionStore.updateDecideStatus(canvasId, conn.id, 'pending', null);
      });

      // 呼叫 AI decide service
      const decision = await aiDecideService.decideConnections(canvasId, sourcePodId, connections);

      // 處理結果
      for (const result of decision.results) {
        const connection = connections.find(c => c.id === result.connectionId);
        if (!connection) continue;

        connectionStore.updateDecideStatus(
          canvasId,
          result.connectionId,
          result.shouldTrigger ? 'approved' : 'rejected',
          result.reason
        );

        workflowEventEmitter.emitAiDecideResult(
          canvasId,
          result.connectionId,
          sourcePodId,
          connection.targetPodId,
          result.shouldTrigger,
          result.reason
        );

        if (result.shouldTrigger) {
          // 檢查是否為多輸入場景
          const { isMultiInput } = workflowStateService.checkMultiInputScenario(canvasId, connection.targetPodId);

          if (isMultiInput && pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
            // 記錄 completion（這會在 multiInputService 中處理）
          } else {
            // 執行 pipeline
            const pipelineContext = {
              canvasId,
              sourcePodId,
              connection,
              triggerMode: 'ai-decide' as const,
              decideResult: { connectionId: connection.id, approved: true, reason: result.reason },
            };
            await mockPipeline.execute(pipelineContext, mockAiDecideStrategy);
          }
        } else {
          // Rejected - 檢查是否為多輸入場景
          const { isMultiInput } = workflowStateService.checkMultiInputScenario(canvasId, connection.targetPodId);
          if (isMultiInput && pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
            pendingTargetStore.recordSourceRejection(connection.targetPodId, sourcePodId, result.reason);
          }
        }
      }

      // 處理錯誤
      for (const errorResult of decision.errors) {
        const connection = connections.find(c => c.id === errorResult.connectionId);
        if (!connection) continue;

        connectionStore.updateDecideStatus(
          canvasId,
          errorResult.connectionId,
          'error',
          `錯誤：${errorResult.error}`
        );

        workflowEventEmitter.emitAiDecideError(
          canvasId,
          errorResult.connectionId,
          sourcePodId,
          connection.targetPodId,
          `錯誤：${errorResult.error}`
        );
      }
    }),
    init: vi.fn(),
  };

  beforeEach(() => {
    // Initialize workflowExecutionService with mocks
    workflowExecutionService.init({
      pipeline: mockPipeline as any,
      aiDecideTriggerService: mockAiDecideTriggerService as any,
      autoTriggerService: mockAutoTriggerService as any,
      directTriggerService: mockDirectStrategy,
    });

    // Reset all mocks
    (connectionStore.findBySourcePodId as any).mockClear?.();
    (connectionStore.getById as any).mockClear?.();
    (connectionStore.updateDecideStatus as any).mockClear?.();
    (podStore.getById as any).mockClear?.();
    (podStore.setStatus as any).mockClear?.();
    (messageStore.getMessages as any).mockClear?.();
    (summaryService.generateSummaryForTarget as any).mockClear?.();
    (workflowStateService.checkMultiInputScenario as any).mockClear?.();
    (workflowStateService.emitPendingStatus as any).mockClear?.();
    (pendingTargetStore.initializePendingTarget as any).mockClear?.();
    (pendingTargetStore.recordSourceCompletion as any).mockClear?.();
    (pendingTargetStore.recordSourceRejection as any).mockClear?.();
    (pendingTargetStore.getCompletedSummaries as any).mockClear?.();
    (pendingTargetStore.clearPendingTarget as any).mockClear?.();
    (workflowEventEmitter.emitAiDecidePending as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideResult as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideError as any).mockClear?.();
    (aiDecideService.decideConnections as any).mockClear?.();
    (pendingTargetStore.hasPendingTarget as any).mockClear?.();

    // Reset service mocks
    (mockPipeline.execute as any).mockClear();
    (mockAutoTriggerService.processAutoTriggerConnection as any).mockClear();
    (mockAiDecideTriggerService.processAiDecideConnections as any).mockClear();

    // Reset strategy mocks
    (mockAutoStrategy.decide as any).mockClear();
    (mockAutoStrategy.onTrigger as any).mockClear();
    (mockAutoStrategy.onComplete as any).mockClear();
    (mockAutoStrategy.onError as any).mockClear();
    (mockAutoStrategy.onQueued as any).mockClear();
    (mockAutoStrategy.onQueueProcessed as any).mockClear();

    (mockDirectStrategy.decide as any).mockClear();
    (mockDirectStrategy.collectSources as any).mockClear();
    (mockDirectStrategy.onTrigger as any).mockClear();
    (mockDirectStrategy.onComplete as any).mockClear();
    (mockDirectStrategy.onError as any).mockClear();
    (mockDirectStrategy.onQueued as any).mockClear();
    (mockDirectStrategy.onQueueProcessed as any).mockClear();

    (mockAiDecideStrategy.decide as any).mockClear();
    (mockAiDecideStrategy.onTrigger as any).mockClear();
    (mockAiDecideStrategy.onComplete as any).mockClear();
    (mockAiDecideStrategy.onError as any).mockClear();
    (mockAiDecideStrategy.onQueued as any).mockClear();
    (mockAiDecideStrategy.onQueueProcessed as any).mockClear();

    // Default mock returns
    (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
      if (podId === sourcePodId) return mockSourcePod;
      if (podId.startsWith('target-pod') || podId.startsWith('target-multi')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
      return null;
    });
    (messageStore.getMessages as any).mockReturnValue(mockMessages);
    (summaryService.generateSummaryForTarget as any).mockResolvedValue({
      success: true,
      summary: 'Test summary',
    });
    (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });
    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);
  });

  describe('checkAndTriggerWorkflows 同時處理 auto 和 ai-decide connections', () => {
    it('正確分組並平行處理兩種 connections', async () => {
      (connectionStore.findBySourcePodId as any).mockReturnValue([
        mockAutoConnection,
        mockAiDecideConnection,
      ]);
      (connectionStore.getById as any).mockImplementation((cId: string, connId: string) => {
        if (connId === 'conn-auto-1') return mockAutoConnection;
        if (connId === 'conn-ai-1') return mockAiDecideConnection;
        return null;
      });

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 驗證 ai-decide connection 的處理
      expect(workflowEventEmitter.emitAiDecidePending).toHaveBeenCalledWith(
        canvasId,
        ['conn-ai-1'],
        sourcePodId
      );
      expect(aiDecideService.decideConnections).toHaveBeenCalledWith(
        canvasId,
        sourcePodId,
        [mockAiDecideConnection]
      );

      // 驗證至少有嘗試生成摘要（因為 auto 和 ai-decide approved 都會觸發）
      expect(summaryService.generateSummaryForTarget).toHaveBeenCalled();
    });
  });

  describe('auto connections 走現有流程不受影響', () => {
    it('只有 auto connection 時，正常觸發 workflow', async () => {
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockAutoConnection]);
      (connectionStore.getById as any).mockReturnValue(mockAutoConnection);

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      expect(summaryService.generateSummaryForTarget).toHaveBeenCalledWith(
        canvasId,
        sourcePodId,
        targetPodId
      );
      expect(aiDecideService.decideConnections).not.toHaveBeenCalled();
    });
  });

  describe('ai-decide connections 呼叫 aiDecideService 進行判斷', () => {
    it('正確呼叫 aiDecideService 並處理批次判斷', async () => {
      const aiConn2: Connection = {
        ...mockAiDecideConnection,
        id: 'conn-ai-2',
        targetPodId: 'target-pod-3',
      };

      (connectionStore.findBySourcePodId as any).mockReturnValue([
        mockAiDecideConnection,
        aiConn2,
      ]);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務 1' },
          { connectionId: 'conn-ai-2', shouldTrigger: false, reason: '不相關任務 2' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      expect(workflowEventEmitter.emitAiDecidePending).toHaveBeenCalledWith(
        canvasId,
        ['conn-ai-1', 'conn-ai-2'],
        sourcePodId
      );
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(canvasId, 'conn-ai-1', 'pending', null);
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(canvasId, 'conn-ai-2', 'pending', null);
      expect(aiDecideService.decideConnections).toHaveBeenCalledTimes(1);
    });
  });

  describe('ai-decide 判斷為觸發時，正確觸發 summary 生成和 target pod chat', () => {
    it('shouldTrigger: true 時，更新狀態為 approved 並觸發 workflow', async () => {
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockAiDecideConnection]);
      (connectionStore.getById as any).mockReturnValue(mockAiDecideConnection);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '上游結果與下游需求相關' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'approved',
        '上游結果與下游需求相關'
      );
      expect(workflowEventEmitter.emitAiDecideResult).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod-2',
        true,
        '上游結果與下游需求相關'
      );
      expect(summaryService.generateSummaryForTarget).toHaveBeenCalled();
    });
  });

  describe('ai-decide 判斷為不觸發時，不觸發 target pod，發送 rejected 事件', () => {
    it('shouldTrigger: false 時，更新狀態為 rejected 且不觸發', async () => {
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockAiDecideConnection]);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: false, reason: '上游產出與下游任務無關' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 等待 Promise 完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'rejected',
        '上游產出與下游任務無關'
      );
      expect(workflowEventEmitter.emitAiDecideResult).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod-2',
        false,
        '上游產出與下游任務無關'
      );
      // 不應該生成 summary（因為不觸發）
      expect(summaryService.generateSummaryForTarget).not.toHaveBeenCalled();
    });
  });

  describe('混合情境中 auto 和 ai-decide 平行處理、互不等待', () => {
    it('auto 和 ai-decide 同時執行，互不阻塞', async () => {
      const autoConn2: Connection = {
        ...mockAutoConnection,
        id: 'conn-auto-2',
        targetPodId: 'target-pod-3',
      };

      (connectionStore.findBySourcePodId as any).mockReturnValue([
        mockAutoConnection,
        autoConn2,
        mockAiDecideConnection,
      ]);
      (connectionStore.getById as any).mockImplementation((cId: string, connId: string) => {
        if (connId === 'conn-auto-1') return mockAutoConnection;
        if (connId === 'conn-auto-2') return autoConn2;
        if (connId === 'conn-ai-1') return mockAiDecideConnection;
        return null;
      });

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 等待 fire-and-forget 的 pipeline.execute 完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 驗證 auto connections 被處理
      // 注意：重構後每個 connection 只呼叫 1 次 generateSummaryForTarget（在 Pipeline 中）
      expect(summaryService.generateSummaryForTarget).toHaveBeenCalledTimes(3); // 2 auto + 1 ai-decide

      // 驗證 ai-decide connection 被處理
      expect(aiDecideService.decideConnections).toHaveBeenCalledTimes(1);
      expect(workflowEventEmitter.emitAiDecideResult).toHaveBeenCalled();
    });
  });

  describe('多輸入場景中 ai-decide rejected 導致 target 永不觸發', () => {
    it('多輸入場景中，rejected source 導致 target 永不觸發', async () => {
      const targetPodWithMultiInput = 'target-multi-input';

      const aiConn: Connection = {
        ...mockAiDecideConnection,
        targetPodId: targetPodWithMultiInput,
      };

      (connectionStore.findBySourcePodId as any).mockReturnValue([aiConn]);

      (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: true,
        requiredSourcePodIds: [sourcePodId, 'another-source'],
      });

      (pendingTargetStore.hasPendingTarget as any).mockReturnValue(true);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: false, reason: '不相關' },
        ],
        errors: [],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 驗證 rejection 被記錄
      expect(pendingTargetStore.recordSourceRejection).toHaveBeenCalledWith(
        targetPodWithMultiInput,
        sourcePodId,
        '不相關'
      );

      // 不應該觸發 summary 生成
      expect(summaryService.generateSummaryForTarget).not.toHaveBeenCalled();
    });
  });

  describe('AI Decide 錯誤處理', () => {
    it('aiDecideService 回傳 errors 時，正確更新狀態並發送 error 事件', async () => {
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockAiDecideConnection]);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [],
        errors: [
          { connectionId: 'conn-ai-1', error: 'AI decision failed' },
        ],
      });

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 等待 Promise 完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'error',
        '錯誤：AI decision failed'
      );
      expect(workflowEventEmitter.emitAiDecideError).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod-2',
        '錯誤：AI decision failed'
      );
    });
  });

  describe('多輸入 auto 場景在 target Pod busy 時進入 queue', () => {
    it('所有來源都回應完畢且 target Pod 為 chatting 時，應 enqueue 而非直接觸發', async () => {
      const source1PodId = 'source-pod-1';
      const source2PodId = 'source-pod-2';
      const multiInputTargetPodId = 'target-multi-input';

      const conn1: Connection = {
        id: 'conn-auto-1',
        sourcePodId: source1PodId,
        sourceAnchor: 'right',
        targetPodId: multiInputTargetPodId,
        targetAnchor: 'left',
        triggerMode: 'auto',
        decideStatus: 'none',
        decideReason: null,
        connectionStatus: 'idle',
        createdAt: new Date(),
      };

      (connectionStore.findBySourcePodId as any).mockReturnValue([conn1]);
      (connectionStore.getById as any).mockReturnValue(conn1);

      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === multiInputTargetPodId) {
          return { ...mockTargetPod, id: podId, status: 'chatting' };
        }
        return { ...mockSourcePod, id: podId };
      });

      (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: true,
        requiredSourcePodIds: [source1PodId, source2PodId],
      });

      (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);

      (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: false,
      });

      (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(
        new Map([
          [source1PodId, 'Summary from source 1'],
          [source2PodId, 'Summary from source 2'],
        ])
      );

      // Mock workflowMultiInputService 來真實呼叫 enqueue
      (workflowMultiInputService.handleMultiInputForConnection as any).mockImplementation(
        async (canvasId: string, sourcePodId: string, connection: Connection, requiredSourcePodIds: string[], summary: string, triggerMode: 'auto' | 'ai-decide') => {
          // 模擬真實行為：檢查 targetPod 狀態並 enqueue
          const targetPod = podStore.getById(canvasId, connection.targetPodId);
          if (targetPod && targetPod.status === 'chatting') {
            workflowQueueService.enqueue({
              canvasId,
              connectionId: connection.id,
              sourcePodId,
              targetPodId: connection.targetPodId,
              summary: 'merged summary',
              isSummarized: true,
              triggerMode,
            });
            pendingTargetStore.clearPendingTarget(connection.targetPodId);
          }
        }
      );

      const enqueueSpy = vi.spyOn(workflowQueueService, 'enqueue');

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source1PodId);

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: conn1.id,
          targetPodId: multiInputTargetPodId,
          isSummarized: true,
          triggerMode: 'auto',
        })
      );

      expect(pendingTargetStore.clearPendingTarget).toHaveBeenCalledWith(multiInputTargetPodId);
    });
  });

  describe('多輸入 AI Decide 場景在 target Pod busy 時進入 queue', () => {
    it('所有來源都回應完畢且 target Pod 為 chatting 時，應 enqueue 而非直接觸發', async () => {
      const source1PodId = 'source-pod-1';
      const source2PodId = 'source-pod-2';
      const multiInputTargetPodId = 'target-multi-input';

      const aiConn: Connection = {
        id: 'conn-ai-1',
        sourcePodId: source1PodId,
        sourceAnchor: 'right',
        targetPodId: multiInputTargetPodId,
        targetAnchor: 'left',
        triggerMode: 'ai-decide',
        decideStatus: 'none',
        decideReason: null,
        connectionStatus: 'idle',
        createdAt: new Date(),
      };

      (connectionStore.findBySourcePodId as any).mockReturnValue([aiConn]);
      (connectionStore.getById as any).mockReturnValue(aiConn);

      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === multiInputTargetPodId) {
          return { ...mockTargetPod, id: podId, status: 'chatting' };
        }
        return { ...mockSourcePod, id: podId };
      });

      (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: true,
        requiredSourcePodIds: [source1PodId, source2PodId],
      });

      (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: aiConn.id, shouldTrigger: true, reason: '相關任務' },
        ],
        errors: [],
      });

      (pendingTargetStore.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: false,
      });

      (pendingTargetStore.getCompletedSummaries as any).mockReturnValue(
        new Map([
          [source1PodId, 'Summary from source 1'],
          [source2PodId, 'Summary from source 2'],
        ])
      );

      // Mock workflowMultiInputService 來真實呼叫 enqueue
      (workflowMultiInputService.handleMultiInputForConnection as any).mockImplementation(
        async (canvasId: string, sourcePodId: string, connection: Connection, requiredSourcePodIds: string[], summary: string, triggerMode: 'auto' | 'ai-decide') => {
          // 模擬真實行為：檢查 targetPod 狀態並 enqueue
          const targetPod = podStore.getById(canvasId, connection.targetPodId);
          if (targetPod && targetPod.status === 'chatting') {
            workflowQueueService.enqueue({
              canvasId,
              connectionId: connection.id,
              sourcePodId,
              targetPodId: connection.targetPodId,
              summary: 'merged summary',
              isSummarized: true,
              triggerMode,
            });
            pendingTargetStore.clearPendingTarget(connection.targetPodId);
          }
        }
      );

      const enqueueSpy = vi.spyOn(workflowQueueService, 'enqueue');

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source1PodId);

      // 等待 fire-and-forget 的 pipeline.execute 完成
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: aiConn.id,
          targetPodId: multiInputTargetPodId,
          isSummarized: true,
          triggerMode: 'ai-decide',
        })
      );

      expect(pendingTargetStore.clearPendingTarget).toHaveBeenCalledWith(multiInputTargetPodId);
    });
  });
});
