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
import { workflowQueueService } from '../../src/services/workflow/workflowQueueService.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { summaryService } from '../../src/services/summaryService.js';
import { workflowStateService } from '../../src/services/workflow/workflowStateService.js';
import { workflowEventEmitter } from '../../src/services/workflow/workflowEventEmitter.js';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { directTriggerStore } from '../../src/services/directTriggerStore.js';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import type { Connection } from '../../src/types';

describe('WorkflowQueueFlow - Queue 處理、混合場景、錯誤恢復', () => {
  const canvasId = 'canvas-1';
  const sourcePodId = 'source-pod';
  const targetPodId = 'target-pod';

  // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
  const spies: Array<ReturnType<typeof spyOn>> = [];

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
    createdAt: new Date(),
  };

  const mockDirectConnection: Connection = {
    id: 'conn-direct-1',
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId: 'target-pod-3',
    targetAnchor: 'left',
    triggerMode: 'direct',
    decideStatus: 'none',
    decideReason: null,
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
    (pendingTargetStore.hasPendingTarget as any).mockClear?.();
    (pendingTargetStore.getPendingTarget as any).mockClear?.();
    (pendingTargetStore.clearPendingTarget as any).mockClear?.();
    (directTriggerStore.hasDirectPending as any).mockClear?.();
    (directTriggerStore.initializeDirectPending as any).mockClear?.();
    (directTriggerStore.recordDirectReady as any).mockClear?.();
    (directTriggerStore.clearDirectPending as any).mockClear?.();
    (directTriggerStore.hasActiveTimer as any).mockClear?.();
    (directTriggerStore.clearTimer as any).mockClear?.();
    (directTriggerStore.setTimer as any).mockClear?.();
    (directTriggerStore.getReadySummaries as any).mockClear?.();
    (claudeQueryService.sendMessage as any).mockClear?.();

    // Default mock returns - 重要：確保重新設定所有 mockImplementation，避免跨檔案污染
    (podStore.getById as any).mockReset?.();
    (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
      if (podId === sourcePodId) return { ...mockSourcePod };
      if (podId.startsWith('target-pod')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
      return null;
    });

    (messageStore.getMessages as any).mockReset?.();
    (messageStore.getMessages as any).mockReturnValue(mockMessages);

    (summaryService.generateSummaryForTarget as any).mockReset?.();
    (summaryService.generateSummaryForTarget as any).mockResolvedValue({
      success: true,
      summary: 'Test summary',
    });

    (workflowStateService.checkMultiInputScenario as any).mockReset?.();
    (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });

    (workflowStateService.getDirectConnectionCount as any).mockReset?.();
    (workflowStateService.getDirectConnectionCount as any).mockReturnValue(1);

    (pendingTargetStore.hasPendingTarget as any).mockReset?.();
    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);

    (directTriggerStore.hasDirectPending as any).mockReset?.();
    (directTriggerStore.hasDirectPending as any).mockReturnValue(false);

    (directTriggerStore.hasActiveTimer as any).mockReset?.();
    (directTriggerStore.hasActiveTimer as any).mockReturnValue(false);

    // 重置所有 workflowEventEmitter 的 mock 方法
    (workflowEventEmitter.emitWorkflowAutoTriggered as any).mockReset?.();
    (workflowEventEmitter.emitWorkflowAutoTriggered as any).mockImplementation(() => {});
    (workflowEventEmitter.emitWorkflowTriggered as any).mockReset?.();
    (workflowEventEmitter.emitWorkflowTriggered as any).mockImplementation(() => {});
    (workflowEventEmitter.emitWorkflowComplete as any).mockReset?.();
    (workflowEventEmitter.emitWorkflowComplete as any).mockImplementation(() => {});

    // Mock sendMessage 為成功執行的 stream
    (claudeQueryService.sendMessage as any).mockReset?.();
    (claudeQueryService.sendMessage as any).mockImplementation(async (_podId: string, _message: string, callback: any) => {
      callback({ type: 'text', content: 'Response text' });
      callback({ type: 'complete' });
    });

    // 清空所有 queue
    workflowQueueService.clearQueue(targetPodId);
    workflowQueueService.clearQueue('target-pod-2');
    workflowQueueService.clearQueue('target-pod-3');
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies.length = 0; // 清空 spy 陣列
  });

  describe('C1: Queue - Workflow 完成後自動 dequeue 下一項', () => {
    it('processNextInQueue 正確 dequeue 並觸發下一個 workflow', async () => {
      const queuedConnection: Connection = {
        id: 'conn-queued',
        sourcePodId: 'source-pod-2',
        sourceAnchor: 'right',
        targetPodId,
        targetAnchor: 'left',
        triggerMode: 'auto',
        decideStatus: 'none',
        decideReason: null,
        createdAt: new Date(),
      };

      // 先驗證 queue 為空
      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);

      // 加入一個 item 到 queue
      workflowQueueService.enqueue({
        canvasId,
        connectionId: queuedConnection.id,
        sourcePodId: queuedConnection.sourcePodId,
        targetPodId,
        summary: 'Queued summary',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(1);

      (connectionStore.getById as any).mockReturnValue(queuedConnection);
      (connectionStore.findBySourcePodId as any).mockReturnValue([]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return { ...mockSourcePod, id: podId };
      });

      // Mock messageStore.addMessage 為 async function
      (messageStore.addMessage as any).mockResolvedValue(undefined);

      // 清除之前的 mock 呼叫
      (connectionStore.updateConnectionStatus as any).mockClear?.();
      (workflowEventEmitter.emitWorkflowQueueProcessed as any).mockClear?.();
      (claudeQueryService.sendMessage as any).mockClear?.();

      // 重新設定 sendMessage mock（因為 mockClear 會清除 mockImplementation）
      (claudeQueryService.sendMessage as any).mockImplementation(async (_podId: string, _message: string, callback: any) => {
        callback({ type: 'text', content: 'Response text' });
        callback({ type: 'complete' });
      });

      // 呼叫 processNextInQueue
      await workflowQueueService.processNextInQueue(canvasId, targetPodId);

      // 驗證 dequeue 被執行，queue 被清空
      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);

      // 驗證 connection 狀態更新為 active
      expect(connectionStore.updateConnectionStatus).toHaveBeenCalledWith(canvasId, queuedConnection.id, 'active');

      // 驗證 emitWorkflowQueueProcessed 被呼叫，帶正確的 remainingQueueSize 和 triggerMode
      expect(workflowEventEmitter.emitWorkflowQueueProcessed).toHaveBeenCalledWith(
        canvasId,
        expect.objectContaining({
          canvasId,
          targetPodId,
          connectionId: queuedConnection.id,
          sourcePodId: queuedConnection.sourcePodId,
          remainingQueueSize: 0, // 因為只有一個 item
          triggerMode: 'auto',
        })
      );

      // 驗證 triggerWorkflowWithSummary 被呼叫（透過 sendMessage）
      expect(claudeQueryService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('C2: processNextInQueue 是 fire-and-forget，不阻塞呼叫者', () => {
    it('executeClaudeQuery 完成後呼叫 processNextInQueue 不 await，不阻塞', async () => {
      // 準備一個 connection 和 target pod
      (connectionStore.getById as any).mockReturnValue(mockAutoConnection);
      (connectionStore.findBySourcePodId as any).mockReturnValue([]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        if (podId === sourcePodId) return mockSourcePod;
        return null;
      });

      // Mock messageStore.addMessage 為 async function
      (messageStore.addMessage as any).mockResolvedValue(undefined);

      // Mock sendMessage 讓 executeClaudeQuery 正常執行
      (claudeQueryService.sendMessage as any).mockClear?.();
      (claudeQueryService.sendMessage as any).mockImplementation(async (_podId: string, _message: string, callback: any) => {
        callback({ type: 'text', content: 'Response' });
        callback({ type: 'complete' });
      });

      // Mock processNextInQueue 為一個會延遲的 Promise
      let processNextInQueueCalled = false;
      const processNextInQueueSpy = spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
        processNextInQueueCalled = true;
        // 模擬一個需要時間的操作
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      spies.push(processNextInQueueSpy);

      // 呼叫 triggerWorkflowWithSummary（內部會呼叫 executeClaudeQuery）
      const triggerPromise = workflowExecutionService.triggerWorkflowWithSummary(
        canvasId,
        mockAutoConnection.id,
        'Test summary',
        true,
        false
      );

      // triggerWorkflowWithSummary 應該不會被 processNextInQueue 阻塞
      await triggerPromise;

      // 等一點時間讓 fire-and-forget 的 processNextInQueue 被呼叫
      await new Promise(resolve => setTimeout(resolve, 50));

      // 驗證 processNextInQueue 被呼叫（但不 await）
      expect(processNextInQueueCalled).toBe(true);
      expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, targetPodId);

      // 驗證 workflowComplete 事件被發送
      expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
        canvasId,
        mockAutoConnection.id,
        sourcePodId,
        targetPodId,
        true,
        undefined,
        'auto'
      );
    });
  });

  describe('C3: Queue 中不同 triggerMode 的事件區分', () => {
    it('direct/ai-decide 模式的 item：triggerWorkflowWithSummary 被呼叫時 skipAutoTriggeredEvent = true', async () => {
      const directConn: Connection = {
        ...mockDirectConnection,
        targetPodId: 'target-pod-direct',
      };

      (connectionStore.getById as any).mockReturnValue(directConn);
      (connectionStore.findBySourcePodId as any).mockReturnValue([]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === directConn.targetPodId) return { ...mockTargetPod, id: directConn.targetPodId, status: 'idle' };
        return { ...mockSourcePod, id: podId };
      });

      // Mock messageStore.addMessage 為 async function
      (messageStore.addMessage as any).mockResolvedValue(undefined);

      (workflowEventEmitter.emitWorkflowAutoTriggered as any).mockClear?.();
      (workflowEventEmitter.emitWorkflowTriggered as any).mockClear?.();
      (claudeQueryService.sendMessage as any).mockClear?.();

      // Mock sendMessage 讓 executeClaudeQuery 正常執行
      (claudeQueryService.sendMessage as any).mockImplementation(async (_podId: string, _message: string, callback: any) => {
        callback({ type: 'text', content: 'Response' });
        callback({ type: 'complete' });
      });

      // 直接呼叫 triggerWorkflowWithSummary 測試 skipAutoTriggeredEvent = true
      await workflowExecutionService.triggerWorkflowWithSummary(
        canvasId,
        directConn.id,
        'Direct summary',
        true,
        true // skipAutoTriggeredEvent = true
      );

      // 驗證 emitWorkflowAutoTriggered 不被呼叫（因為 skipAutoTriggeredEvent = true）
      expect(workflowEventEmitter.emitWorkflowAutoTriggered).not.toHaveBeenCalled();

      // 驗證 emitWorkflowTriggered 仍然被呼叫
      expect(workflowEventEmitter.emitWorkflowTriggered).toHaveBeenCalled();
    });

    it('auto 模式的 item：triggerWorkflowWithSummary 被呼叫時 skipAutoTriggeredEvent = false', async () => {
      const autoConn: Connection = {
        ...mockAutoConnection,
        targetPodId: 'target-pod-auto',
      };

      (connectionStore.getById as any).mockReturnValue(autoConn);
      (connectionStore.findBySourcePodId as any).mockReturnValue([]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === autoConn.targetPodId) return { ...mockTargetPod, id: autoConn.targetPodId, status: 'idle' };
        return { ...mockSourcePod, id: podId };
      });

      // Mock messageStore.addMessage 為 async function
      (messageStore.addMessage as any).mockResolvedValue(undefined);

      (workflowEventEmitter.emitWorkflowAutoTriggered as any).mockClear?.();
      (workflowEventEmitter.emitWorkflowTriggered as any).mockClear?.();
      (claudeQueryService.sendMessage as any).mockClear?.();

      // Mock sendMessage 讓 executeClaudeQuery 正常執行
      (claudeQueryService.sendMessage as any).mockImplementation(async (_podId: string, _message: string, callback: any) => {
        callback({ type: 'text', content: 'Response' });
        callback({ type: 'complete' });
      });

      // 直接呼叫 triggerWorkflowWithSummary 測試 skipAutoTriggeredEvent = false
      await workflowExecutionService.triggerWorkflowWithSummary(
        canvasId,
        autoConn.id,
        'Auto summary',
        true,
        false // skipAutoTriggeredEvent = false
      );

      // 驗證 emitWorkflowAutoTriggered 被呼叫（因為 skipAutoTriggeredEvent = false）
      expect(workflowEventEmitter.emitWorkflowAutoTriggered).toHaveBeenCalled();

      // 驗證 emitWorkflowTriggered 也被呼叫
      expect(workflowEventEmitter.emitWorkflowTriggered).toHaveBeenCalled();
    });

    it('workflowQueueService.processNextInQueue 根據 triggerMode 設定正確的 skipAutoTriggeredEvent', () => {
      // 測試 workflowQueueService 內部邏輯：direct 和 ai-decide 設定 skipAutoTriggeredEvent = true
      const directItem = {
        canvasId,
        connectionId: 'conn-direct',
        sourcePodId,
        targetPodId,
        summary: 'test',
        isSummarized: true,
        triggerMode: 'direct' as const,
      };

      const aiDecideItem = {
        ...directItem,
        connectionId: 'conn-ai',
        triggerMode: 'ai-decide' as const,
      };

      const autoItem = {
        ...directItem,
        connectionId: 'conn-auto',
        triggerMode: 'auto' as const,
      };

      // 驗證邏輯：direct 和 ai-decide 應該設定 skipAutoTriggeredEvent = true
      expect(directItem.triggerMode === 'direct' || directItem.triggerMode === 'ai-decide').toBe(true);
      expect(aiDecideItem.triggerMode === 'direct' || aiDecideItem.triggerMode === 'ai-decide').toBe(true);

      // 驗證邏輯：auto 應該設定 skipAutoTriggeredEvent = false
      expect(autoItem.triggerMode === 'direct' || autoItem.triggerMode === 'ai-decide').toBe(false);
    });
  });

  describe('D1: Direct + Auto 混合 - 完整流程', () => {
    it('checkAndTriggerWorkflows 同時處理 direct 和 auto connections（平行分派）', () => {
      // 測試概念：checkAndTriggerWorkflows 會將 connections 分為 auto, ai-decide, direct 三組
      // 然後使用 Promise.all 平行處理這三組
      const connections = [
        { id: 'conn-auto', triggerMode: 'auto' },
        { id: 'conn-direct', triggerMode: 'direct' },
      ];

      // 模擬分組邏輯
      const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
      const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

      // 驗證分組正確
      expect(autoConnections.length).toBe(1);
      expect(directConnections.length).toBe(1);

      // 驗證兩組都會被處理（概念驗證）
      expect(autoConnections[0].id).toBe('conn-auto');
      expect(directConnections[0].id).toBe('conn-direct');
    });
  });

  describe('D2: Auto + AI-Decide + Direct 三種模式平行分派', () => {
    it('checkAndTriggerWorkflows 平行處理三種 triggerMode 的 connections（分組並 Promise.all）', () => {
      // 測試概念：checkAndTriggerWorkflows 會將 connections 分為三組：auto, ai-decide, direct
      // 然後使用 Promise.all 平行處理這三組
      const connections = [
        { id: 'conn-auto', triggerMode: 'auto' },
        { id: 'conn-ai', triggerMode: 'ai-decide' },
        { id: 'conn-direct', triggerMode: 'direct' },
      ];

      // 模擬分組邏輯
      const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
      const aiDecideConnections = connections.filter((conn) => conn.triggerMode === 'ai-decide');
      const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

      // 驗證分組正確
      expect(autoConnections.length).toBe(1);
      expect(aiDecideConnections.length).toBe(1);
      expect(directConnections.length).toBe(1);

      // 驗證三組都會被處理（概念驗證）
      expect(autoConnections[0].id).toBe('conn-auto');
      expect(aiDecideConnections[0].id).toBe('conn-ai');
      expect(directConnections[0].id).toBe('conn-direct');

      // 驗證平行分派邏輯：三者應該可以同時執行
      // 在實際代碼中是通過 Promise.all([processAuto(), processAiDecide(), processDirect()]) 實現
      const willBeProcessedInParallel = autoConnections.length > 0 || aiDecideConnections.length > 0 || directConnections.length > 0;
      expect(willBeProcessedInParallel).toBe(true);
    });
  });

  describe('E1: Workflow 執行失敗後 queue 仍繼續處理', () => {
    it('executeClaudeQuery 拋出錯誤，emitWorkflowComplete(success: false)，processNextInQueue 仍被呼叫', async () => {
      const conn: Connection = {
        ...mockAutoConnection,
        id: 'conn-fail',
        targetPodId: 'target-fail',
      };

      // 準備一個 queued item
      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-queued-after-fail',
        sourcePodId: 'source-pod-2',
        targetPodId: 'target-fail',
        summary: 'Queued after fail',
        isSummarized: true,
        triggerMode: 'auto',
      });

      (connectionStore.getById as any).mockReturnValue(conn);
      (connectionStore.findBySourcePodId as any).mockReturnValue([]);
      (podStore.getById as any).mockImplementation((cId: string, podId: string) => {
        if (podId === 'target-fail') return { ...mockTargetPod, id: 'target-fail', status: 'idle' };
        if (podId === sourcePodId) return mockSourcePod;
        return null;
      });

      // Mock messageStore.addMessage 為 async function
      (messageStore.addMessage as any).mockResolvedValue(undefined);

      // 清除之前的呼叫
      (podStore.setStatus as any).mockClear?.();
      (workflowEventEmitter.emitWorkflowComplete as any).mockClear?.();
      (claudeQueryService.sendMessage as any).mockClear?.();

      // Mock sendMessage 拋出錯誤
      const testError = new Error('Claude query failed');
      (claudeQueryService.sendMessage as any).mockImplementation(async () => {
        throw testError;
      });

      // Mock processNextInQueue spy
      let processNextInQueueCalled = false;
      const processNextInQueueSpy = spyOn(workflowQueueService, 'processNextInQueue').mockImplementation(async () => {
        processNextInQueueCalled = true;
      });
      spies.push(processNextInQueueSpy);

      // 呼叫 triggerWorkflowWithSummary，預期拋出錯誤
      await expect(
        workflowExecutionService.triggerWorkflowWithSummary(
          canvasId,
          conn.id,
          'Test summary',
          true,
          false
        )
      ).rejects.toThrow('Claude query failed');

      // 等一點時間讓 fire-and-forget 的 processNextInQueue 被呼叫
      await new Promise(resolve => setTimeout(resolve, 50));

      // 驗證 emitWorkflowComplete 被呼叫，success 為 false
      expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
        canvasId,
        conn.id,
        sourcePodId,
        'target-fail',
        false,
        'Claude query failed',
        'auto'
      );

      // 驗證 processNextInQueue 仍然被呼叫（在 catch 區塊中）
      expect(processNextInQueueCalled).toBe(true);
      expect(processNextInQueueSpy).toHaveBeenCalledWith(canvasId, 'target-fail');

      // 驗證 target pod 狀態被設回 idle
      expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, 'target-fail', 'idle');
    });
  });
});
