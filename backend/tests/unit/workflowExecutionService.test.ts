import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';

// Mock dependencies
mock.module('../../src/services/connectionStore.js', () => ({
  connectionStore: {
    findBySourcePodId: mock(),
    getById: mock(),
    updateDecideStatus: mock(),
    updateConnectionStatus: mock(),
  },
}));

mock.module('../../src/services/podStore.js', () => ({
  podStore: {
    getById: mock(),
    setStatus: mock(),
  },
}));

mock.module('../../src/services/messageStore.js', () => ({
  messageStore: {
    getMessages: mock(),
  },
}));

mock.module('../../src/services/summaryService.js', () => ({
  summaryService: {
    generateSummaryForTarget: mock(),
  },
}));

mock.module('../../src/services/pendingTargetStore.js', () => ({
  pendingTargetStore: {
    hasPendingTarget: mock(),
    getPendingTarget: mock(),
    clearPendingTarget: mock(),
  },
}));

mock.module('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    checkMultiInputScenario: mock(),
    initializePendingTarget: mock(),
    recordSourceCompletion: mock(),
    recordSourceRejection: mock(),
    getCompletedSummaries: mock(),
    clearPendingTarget: mock(),
  },
}));

mock.module('../../src/services/workflow/workflowEventEmitter.js', () => ({
  workflowEventEmitter: {
    emitWorkflowAutoTriggered: mock(),
    emitWorkflowTriggered: mock(),
    emitAiDecidePending: mock(),
    emitAiDecideResult: mock(),
    emitAiDecideError: mock(),
    emitWorkflowQueued: mock(),
  },
}));

mock.module('../../src/services/workflow/aiDecideService.js', () => ({
  aiDecideService: {
    decideConnections: mock(),
  },
}));

mock.module('../../src/services/autoClear/index.js', () => ({
  autoClearService: {
    initializeWorkflowTracking: mock(),
  },
}));

mock.module('../../src/utils/logger.js', () => ({
  logger: {
    log: mock(),
    error: mock(),
  },
}));

mock.module('../../src/services/socketService.js', () => ({
  socketService: {
    emitToCanvas: mock(),
  },
}));

mock.module('../../src/services/claude/queryService.js', () => ({
  claudeQueryService: {
    executeChatInPod: mock(),
    sendMessage: mock(async () => {}),
  },
}));

mock.module('../../src/services/commandService.js', () => ({
  commandService: {
    getContent: mock(),
    list: mock(async () => []),
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
import type { Connection } from '../../src/types';

describe('WorkflowExecutionService', () => {
  const canvasId = 'canvas-1';
  const sourcePodId = 'source-pod';
  const targetPodId = 'target-pod';

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

  beforeEach(() => {
    // Reset all mocks
    (connectionStore.findBySourcePodId as any).mockClear?.();
    (connectionStore.getById as any).mockClear?.();
    (connectionStore.updateDecideStatus as any).mockClear?.();
    (podStore.getById as any).mockClear?.();
    (podStore.setStatus as any).mockClear?.();
    (messageStore.getMessages as any).mockClear?.();
    (summaryService.generateSummaryForTarget as any).mockClear?.();
    (workflowStateService.checkMultiInputScenario as any).mockClear?.();
    (workflowStateService.initializePendingTarget as any).mockClear?.();
    (workflowStateService.recordSourceCompletion as any).mockClear?.();
    (workflowStateService.recordSourceRejection as any).mockClear?.();
    (workflowStateService.getCompletedSummaries as any).mockClear?.();
    (workflowStateService.clearPendingTarget as any).mockClear?.();
    (workflowEventEmitter.emitAiDecidePending as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideResult as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideError as any).mockClear?.();
    (aiDecideService.decideConnections as any).mockClear?.();
    (pendingTargetStore.hasPendingTarget as any).mockClear?.();

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

      // 驗證 auto connections 被處理（會生成多個摘要）
      expect(summaryService.generateSummaryForTarget).toHaveBeenCalledTimes(3); // 2 auto + 1 ai-decide approved

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
      expect(workflowStateService.recordSourceRejection).toHaveBeenCalledWith(
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

      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'error',
        'AI decision failed'
      );
      expect(workflowEventEmitter.emitAiDecideError).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod-2',
        'AI decision failed'
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

      (workflowStateService.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: false,
      });

      (workflowStateService.getCompletedSummaries as any).mockReturnValue(
        new Map([
          [source1PodId, 'Summary from source 1'],
          [source2PodId, 'Summary from source 2'],
        ])
      );

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue');

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

      expect(workflowStateService.clearPendingTarget).toHaveBeenCalledWith(multiInputTargetPodId);
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

      (workflowStateService.recordSourceCompletion as any).mockReturnValue({
        allSourcesResponded: true,
        hasRejection: false,
      });

      (workflowStateService.getCompletedSummaries as any).mockReturnValue(
        new Map([
          [source1PodId, 'Summary from source 1'],
          [source2PodId, 'Summary from source 2'],
        ])
      );

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue');

      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source1PodId);

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: aiConn.id,
          targetPodId: multiInputTargetPodId,
          isSummarized: true,
          triggerMode: 'ai-decide',
        })
      );

      expect(workflowStateService.clearPendingTarget).toHaveBeenCalledWith(multiInputTargetPodId);
    });
  });
});
