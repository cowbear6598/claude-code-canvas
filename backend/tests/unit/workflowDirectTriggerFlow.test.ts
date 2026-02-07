import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';

// Mock dependencies
mock.module('../../src/services/connectionStore.js', () => ({
  connectionStore: {
    findBySourcePodId: mock(),
    findByTargetPodId: mock(),
    getById: mock(),
    updateDecideStatus: mock(),
    updateConnectionStatus: mock(),
  },
}));

mock.module('../../src/services/podStore.js', () => ({
  podStore: {
    getById: mock(),
    setStatus: mock(),
    updateLastActive: mock(),
  },
}));

mock.module('../../src/services/messageStore.js', () => ({
  messageStore: {
    getMessages: mock(),
    addMessage: mock(async () => {}),
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

mock.module('../../src/services/directTriggerStore.js', () => ({
  directTriggerStore: {
    hasDirectPending: mock(),
    initializeDirectPending: mock(),
    recordDirectReady: mock(),
    clearDirectPending: mock(),
    hasActiveTimer: mock(),
    clearTimer: mock(),
    setTimer: mock(),
    getReadySummaries: mock(),
  },
}));

mock.module('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    checkMultiInputScenario: mock(),
    getDirectConnectionCount: mock(),
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
    emitWorkflowComplete: mock(),
    emitAiDecidePending: mock(),
    emitAiDecideResult: mock(),
    emitAiDecideError: mock(),
    emitWorkflowQueued: mock(),
    emitWorkflowQueueProcessed: mock(),
    emitDirectTriggered: mock(),
    emitDirectWaiting: mock(),
    emitDirectMerged: mock(),
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
    onPodComplete: mock(async () => {}),
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
import { workflowExecutionService } from '../../src/services/workflow/workflowExecutionService.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { summaryService } from '../../src/services/summaryService.js';
import { directTriggerStore } from '../../src/services/directTriggerStore.js';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { workflowStateService } from '../../src/services/workflow/workflowStateService.js';
import { workflowEventEmitter } from '../../src/services/workflow/workflowEventEmitter.js';
import { workflowQueueService } from '../../src/services/workflow/workflowQueueService.js';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import { autoClearService } from '../../src/services/autoClear/index.js';
import type { Connection } from '../../src/types';

describe('Direct Trigger Flow', () => {
  const canvasId = 'canvas-1';
  const sourcePodId = 'source-pod';
  const targetPodId = 'target-pod';
  const connectionId = 'conn-direct-1';

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

  const mockDirectConnection: Connection = {
    id: connectionId,
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    triggerMode: 'direct',
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

  const testSummary = 'Test summary content';

  // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
  const spies: Array<ReturnType<typeof spyOn>> = [];

  beforeEach(() => {
    // Reset all mocks
    (connectionStore.findBySourcePodId as any).mockClear?.();
    (connectionStore.findByTargetPodId as any).mockClear?.();
    (connectionStore.getById as any).mockClear?.();
    (connectionStore.updateDecideStatus as any).mockClear?.();
    (connectionStore.updateConnectionStatus as any).mockClear?.();
    (podStore.getById as any).mockClear?.();
    (podStore.setStatus as any).mockClear?.();
    (podStore.updateLastActive as any).mockClear?.();
    (messageStore.getMessages as any).mockClear?.();
    (messageStore.addMessage as any).mockClear?.();
    (summaryService.generateSummaryForTarget as any).mockClear?.();
    (pendingTargetStore.hasPendingTarget as any).mockClear?.();
    (pendingTargetStore.getPendingTarget as any).mockClear?.();
    (pendingTargetStore.clearPendingTarget as any).mockClear?.();
    (workflowStateService.checkMultiInputScenario as any).mockClear?.();
    (workflowStateService.getDirectConnectionCount as any).mockClear?.();
    (workflowStateService.initializePendingTarget as any).mockClear?.();
    (workflowStateService.recordSourceCompletion as any).mockClear?.();
    (workflowStateService.recordSourceRejection as any).mockClear?.();
    (workflowStateService.getCompletedSummaries as any).mockClear?.();
    (workflowStateService.clearPendingTarget as any).mockClear?.();
    (workflowEventEmitter.emitWorkflowAutoTriggered as any).mockClear?.();
    (workflowEventEmitter.emitWorkflowTriggered as any).mockClear?.();
    (workflowEventEmitter.emitWorkflowComplete as any).mockClear?.();
    (workflowEventEmitter.emitAiDecidePending as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideResult as any).mockClear?.();
    (workflowEventEmitter.emitAiDecideError as any).mockClear?.();
    (workflowEventEmitter.emitWorkflowQueued as any).mockClear?.();
    (workflowEventEmitter.emitWorkflowQueueProcessed as any).mockClear?.();
    (workflowEventEmitter.emitDirectTriggered as any).mockClear?.();
    (workflowEventEmitter.emitDirectWaiting as any).mockClear?.();
    (workflowEventEmitter.emitDirectMerged as any).mockClear?.();
    (directTriggerStore.hasDirectPending as any).mockClear?.();
    (directTriggerStore.initializeDirectPending as any).mockClear?.();
    (directTriggerStore.recordDirectReady as any).mockClear?.();
    (directTriggerStore.clearDirectPending as any).mockClear?.();
    (directTriggerStore.hasActiveTimer as any).mockClear?.();
    (directTriggerStore.clearTimer as any).mockClear?.();
    (directTriggerStore.setTimer as any).mockClear?.();
    (directTriggerStore.getReadySummaries as any).mockClear?.();
    (claudeQueryService.sendMessage as any).mockClear?.();
    (autoClearService.onPodComplete as any).mockClear?.();

    // Default mock returns
    (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
      if (podId === sourcePodId) return { ...mockSourcePod };
      if (podId === targetPodId) return { ...mockTargetPod };
      return null;
    });
    (messageStore.getMessages as any).mockReturnValue(mockMessages);
    (summaryService.generateSummaryForTarget as any).mockResolvedValue({
      success: true,
      summary: testSummary,
    });
    (connectionStore.getById as any).mockReturnValue(mockDirectConnection);
    (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });
    (workflowStateService.getDirectConnectionCount as any).mockReturnValue(1);
    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);
    (directTriggerStore.hasDirectPending as any).mockReturnValue(false);
    (directTriggerStore.hasActiveTimer as any).mockReturnValue(false);
    (claudeQueryService.sendMessage as any).mockImplementation(async (podId: string, message: string, callback: any) => {
      callback({ type: 'text', content: 'Claude response' });
      callback({ type: 'complete' });
    });
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies.length = 0; // 清空 spy 陣列
  });

  describe('A1: 單一 direct - target idle → 直接執行', () => {
    it('Target Pod 只有 1 條 direct 連線，target 狀態為 idle，應直接執行', async () => {
      // 準備
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockDirectConnection]);
      (workflowStateService.getDirectConnectionCount as any).mockReturnValue(1);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return null;
      });

      // Mock triggerWorkflowWithSummary 避免執行完整工作流
      const triggerSpy = spyOn(workflowExecutionService, 'triggerWorkflowWithSummary').mockResolvedValue(undefined);
      spies.push(triggerSpy);

      // 執行
      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 驗證
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledTimes(1);
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledWith(
        canvasId,
        expect.objectContaining({
          canvasId,
          connectionId: mockDirectConnection.id,
          sourcePodId,
          targetPodId,
          transferredContent: testSummary,
          isSummarized: true,
        })
      );

      // 驗證 triggerWorkflowWithSummary 被呼叫
      expect(triggerSpy).toHaveBeenCalledWith(
        canvasId,
        mockDirectConnection.id,
        testSummary,
        true,
        true
      );
    });
  });

  describe('A2: 單一 direct - target busy → 進 queue', () => {
    it('Target Pod 只有 1 條 direct 連線，target 狀態為 chatting，應進入 queue', async () => {
      // 準備
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockDirectConnection]);
      (workflowStateService.getDirectConnectionCount as any).mockReturnValue(1);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' };
        return null;
      });

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue');
      spies.push(enqueueSpy);

      // 執行
      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 驗證
      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: mockDirectConnection.id,
          sourcePodId,
          targetPodId,
          summary: testSummary,
          isSummarized: true,
          triggerMode: 'direct',
        })
      );

      // 驗證 triggerWorkflowWithSummary 不被呼叫
      expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('B1: Multi-direct - 第一個 source 到達 → 初始化等待', () => {
    it('Target Pod 有 2+ 條 direct 連線，第一個 source 完成，應初始化等待並設定 timer', async () => {
      // 準備
      (connectionStore.findBySourcePodId as any).mockReturnValue([mockDirectConnection]);
      (workflowStateService.getDirectConnectionCount as any).mockReturnValue(2);
      (directTriggerStore.hasDirectPending as any).mockReturnValue(false); // 第一次，pending 不存在

      const setTimeoutSpy = spyOn(global, 'setTimeout');
      spies.push(setTimeoutSpy);

      // 執行
      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 驗證
      expect(directTriggerStore.initializeDirectPending).toHaveBeenCalledWith(targetPodId);
      expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, sourcePodId, testSummary);
      expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledWith(
        canvasId,
        expect.objectContaining({
          canvasId,
          connectionId: mockDirectConnection.id,
          sourcePodId,
          targetPodId,
        })
      );

      // 驗證 timer 被設定
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(directTriggerStore.setTimer).toHaveBeenCalled();
    });
  });

  describe('B2: Multi-direct - 第二個 source 到達 → timer 重設', () => {
    it('Target Pod 有 2+ 條 direct 連線，已有一個 source 在 waiting，應重設 timer', async () => {
      const source2PodId = 'source-pod-2';
      const connection2: Connection = {
        ...mockDirectConnection,
        id: 'conn-direct-2',
        sourcePodId: source2PodId,
      };

      // 準備
      (connectionStore.findBySourcePodId as any).mockReturnValue([connection2]);
      (connectionStore.getById as any).mockReturnValue(connection2);
      (workflowStateService.getDirectConnectionCount as any).mockReturnValue(2);
      (directTriggerStore.hasDirectPending as any).mockReturnValue(true); // pending 已存在
      (directTriggerStore.hasActiveTimer as any).mockReturnValue(true); // 有舊 timer

      const setTimeoutSpy = spyOn(global, 'setTimeout');
      spies.push(setTimeoutSpy);

      // 執行
      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source2PodId);

      // 驗證
      expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, source2PodId, testSummary);
      expect(directTriggerStore.clearTimer).toHaveBeenCalledWith(targetPodId); // 舊 timer 被清除
      expect(setTimeoutSpy).toHaveBeenCalled(); // 新 timer 被設定
      expect(directTriggerStore.setTimer).toHaveBeenCalled();
      expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledTimes(1); // 第二次發送 waiting 事件
    });
  });

  describe('B3: Timer 到期 - 單源, target idle → 執行', () => {
    it('只有 1 個 source ready，timer 到期，target idle，應執行工作流', async () => {
      // 準備 - 模擬 timer 到期時的狀態
      const readySummaries = new Map([[sourcePodId, testSummary]]);
      (directTriggerStore.getReadySummaries as any).mockReturnValue(readySummaries);
      (connectionStore.findByTargetPodId as any).mockReturnValue([mockDirectConnection]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return null;
      });

      // Mock triggerWorkflowWithSummary 避免執行完整工作流
      const triggerSpy = spyOn(workflowExecutionService, 'triggerWorkflowWithSummary').mockResolvedValue(undefined);
      spies.push(triggerSpy);

      // 直接呼叫 handleDirectTimerExpired（透過反射訪問私有方法）
      await (workflowExecutionService as any).handleDirectTimerExpired(canvasId, targetPodId);

      // 驗證
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledTimes(1);
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledWith(
        canvasId,
        expect.objectContaining({
          canvasId,
          connectionId: mockDirectConnection.id,
          sourcePodId,
          targetPodId,
          transferredContent: testSummary,
          isSummarized: true,
        })
      );

      // 驗證 triggerWorkflowWithSummary 被呼叫
      expect(triggerSpy).toHaveBeenCalledWith(
        canvasId,
        mockDirectConnection.id,
        testSummary,
        true,
        true
      );

      // 驗證 clearDirectPending 被呼叫
      expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);
    });
  });

  describe('B4: Timer 到期 - 多源合併, target idle → 合併執行 + 其他連線立即 complete', () => {
    it('2 個 source ready，timer 到期，target idle，應合併執行並為其他連線發送 complete', async () => {
      const source2PodId = 'source-pod-2';
      const connection2: Connection = {
        ...mockDirectConnection,
        id: 'conn-direct-2',
        sourcePodId: source2PodId,
      };

      const summary2 = 'Test summary 2';
      const readySummaries = new Map([
        [sourcePodId, testSummary],
        [source2PodId, summary2],
      ]);

      // 準備
      (directTriggerStore.getReadySummaries as any).mockReturnValue(readySummaries);
      (connectionStore.findByTargetPodId as any).mockReturnValue([mockDirectConnection, connection2]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return null;
      });

      // Mock triggerWorkflowWithSummary 避免執行完整工作流（需要先清除之前測試的 spy）
      let triggerCallCount = 0;
      const triggerSpy = spyOn(workflowExecutionService, 'triggerWorkflowWithSummary').mockImplementation(async () => {
        triggerCallCount++;
        return undefined;
      });
      spies.push(triggerSpy);

      // 執行
      await (workflowExecutionService as any).handleDirectTimerExpired(canvasId, targetPodId);

      // 驗證
      expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalledWith(
        canvasId,
        expect.objectContaining({
          canvasId,
          targetPodId,
          sourcePodIds: [sourcePodId, source2PodId],
          countdownSeconds: 0,
        })
      );

      // 驗證 emitDirectTriggered 被呼叫 2 次（每條 direct 連線各一次）
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledTimes(2);

      // 驗證 triggerWorkflowWithSummary 只呼叫 1 次（用合併內容，使用本地計數器而非 spy 的累積計數）
      expect(triggerCallCount).toBe(1);

      // 驗證 emitWorkflowComplete 為「非主要」連線被呼叫（triggerMode: 'direct'）
      expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
        canvasId,
        connection2.id,
        source2PodId,
        targetPodId,
        true,
        undefined,
        'direct'
      );

      // 驗證 clearDirectPending 被呼叫
      expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);
    });
  });

  describe('B5: Timer 到期 - target busy → 主要連線 enqueue + 其他連線 complete', () => {
    it('2 個 source ready，timer 到期，target 正在 chatting，應 enqueue 主要連線', async () => {
      const source2PodId = 'source-pod-2';
      const connection2: Connection = {
        ...mockDirectConnection,
        id: 'conn-direct-2',
        sourcePodId: source2PodId,
      };

      const summary2 = 'Test summary 2';
      const readySummaries = new Map([
        [sourcePodId, testSummary],
        [source2PodId, summary2],
      ]);

      // 準備
      (directTriggerStore.getReadySummaries as any).mockReturnValue(readySummaries);
      (connectionStore.findByTargetPodId as any).mockReturnValue([mockDirectConnection, connection2]);
      (directTriggerStore.hasDirectPending as any).mockReturnValue(false); // target 不在 direct pending 狀態
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' }; // target busy
        return null;
      });

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue');
      spies.push(enqueueSpy);

      // 執行
      await (workflowExecutionService as any).handleDirectTimerExpired(canvasId, targetPodId);

      // 驗證
      expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalled();

      // 驗證所有 direct connections 都發送了 emitDirectTriggered
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledTimes(2);

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          connectionId: mockDirectConnection.id,
          targetPodId,
          isSummarized: true,
          triggerMode: 'direct',
        })
      );

      // 驗證 triggerWorkflowWithSummary 不被呼叫
      expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();

      // 驗證 clearDirectPending 被呼叫
      expect(directTriggerStore.clearDirectPending).toHaveBeenCalledWith(targetPodId);
    });
  });
});
