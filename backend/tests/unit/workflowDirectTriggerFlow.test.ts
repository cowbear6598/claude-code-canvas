import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';

// Import 真實模組
import { workflowExecutionService } from '../../src/services/workflow';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { summaryService } from '../../src/services/summaryService.js';
import { directTriggerStore } from '../../src/services/directTriggerStore.js';
import { workflowStateService } from '../../src/services/workflow';
import { workflowEventEmitter } from '../../src/services/workflow';
import { workflowQueueService } from '../../src/services/workflow';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import { autoClearService } from '../../src/services/autoClear';
import { logger } from '../../src/utils/logger.js';
import { socketService } from '../../src/services/socketService.js';
import { commandService } from '../../src/services/commandService.js';
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
  let spies: Array<ReturnType<typeof spyOn>> = [];

  /**
   * 輔助函數：安全地 spy 或重置已存在的 mock
   * 如果方法已經是 mock（由其他測試的 mock.module 建立），則重置它
   * 否則建立新的 spy
   */
  const setupMock = <T extends object, K extends keyof T>(
    obj: T,
    method: K,
    mockConfig: { returnValue?: any; implementation?: any; resolvedValue?: any }
  ) => {
    const target = obj[method];

    // 如果目標不存在或是 undefined，說明被其他測試的 mock.module 污染但沒有正確初始化
    // 我們需要創建一個新的 mock 函數
    if (target === undefined || target === null) {
      const newMock = mock();
      (obj as any)[method] = newMock;

      if ('returnValue' in mockConfig) {
        newMock.mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        newMock.mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        newMock.mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為這是替換已污染的模組
    }

    // 檢查是否已經是 mock 函數（由其他測試的 mock.module 建立）
    if (typeof target === 'function' && 'mockReturnValue' in target) {
      // 已經是 mock，清空並重新設定
      (target as any).mockClear?.();
      if ('returnValue' in mockConfig) {
        (target as any).mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        (target as any).mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        (target as any).mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為不是我們創建的
    }

    // 真實函數，使用 spyOn
    const spy = spyOn(obj, method as any);
    if ('returnValue' in mockConfig) {
      spy.mockReturnValue(mockConfig.returnValue);
    } else if ('implementation' in mockConfig) {
      spy.mockImplementation(mockConfig.implementation);
    } else if ('resolvedValue' in mockConfig) {
      spy.mockResolvedValue(mockConfig.resolvedValue);
    }
    spies.push(spy);
  };

  beforeEach(() => {
    // 清空 spy 陣列
    spies = [];

    // connectionStore
    setupMock(connectionStore, 'findBySourcePodId', { returnValue: [] });
    setupMock(connectionStore, 'findByTargetPodId', { returnValue: [] });
    setupMock(connectionStore, 'getById', { returnValue: mockDirectConnection });
    setupMock(connectionStore, 'updateDecideStatus', { implementation: () => undefined });
    setupMock(connectionStore, 'updateConnectionStatus', { implementation: () => undefined });

    // podStore
    setupMock(podStore, 'getById', {
      implementation: (cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod };
        return undefined;
      }
    });
    setupMock(podStore, 'setStatus', { implementation: () => {} });
    setupMock(podStore, 'updateLastActive', { implementation: () => {} });

    // messageStore
    setupMock(messageStore, 'getMessages', { returnValue: mockMessages });
    setupMock(messageStore, 'addMessage', { resolvedValue: undefined });

    // summaryService
    setupMock(summaryService, 'generateSummaryForTarget', {
      resolvedValue: {
        success: true,
        summary: testSummary,
      }
    });

    // directTriggerStore
    setupMock(directTriggerStore, 'hasDirectPending', { returnValue: false });
    setupMock(directTriggerStore, 'initializeDirectPending', { implementation: () => {} });
    setupMock(directTriggerStore, 'recordDirectReady', { returnValue: 1 });
    setupMock(directTriggerStore, 'clearDirectPending', { implementation: () => {} });
    setupMock(directTriggerStore, 'hasActiveTimer', { returnValue: false });
    setupMock(directTriggerStore, 'clearTimer', { implementation: () => {} });
    setupMock(directTriggerStore, 'setTimer', { implementation: () => {} });
    setupMock(directTriggerStore, 'getReadySummaries', { returnValue: null });

    // workflowStateService
    setupMock(workflowStateService, 'checkMultiInputScenario', {
      returnValue: {
        isMultiInput: false,
        requiredSourcePodIds: [],
      }
    });
    setupMock(workflowStateService, 'getDirectConnectionCount', { returnValue: 1 });
    setupMock(workflowStateService, 'initializePendingTarget', { implementation: () => {} });
    setupMock(workflowStateService, 'recordSourceCompletion', {
      returnValue: {
        allSourcesResponded: false,
        hasRejection: false,
      }
    });
    setupMock(workflowStateService, 'recordSourceRejection', { implementation: () => {} });
    setupMock(workflowStateService, 'getCompletedSummaries', { returnValue: null });
    setupMock(workflowStateService, 'clearPendingTarget', { implementation: () => {} });

    // workflowEventEmitter
    setupMock(workflowEventEmitter, 'emitWorkflowAutoTriggered', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitWorkflowTriggered', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitWorkflowComplete', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitAiDecidePending', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitAiDecideResult', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitAiDecideError', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitWorkflowQueued', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitWorkflowQueueProcessed', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitDirectTriggered', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitDirectWaiting', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitDirectMerged', { implementation: () => {} });

    // claudeQueryService
    setupMock(claudeQueryService, 'sendMessage', {
      implementation: async (podId: string, message: string, callback: any) => {
        callback({ type: 'text', content: 'Claude response' });
        callback({ type: 'complete' });
      }
    });

    // autoClearService
    setupMock(autoClearService, 'initializeWorkflowTracking', { implementation: () => {} });
    setupMock(autoClearService, 'onPodComplete', { resolvedValue: undefined });

    // logger
    setupMock(logger, 'log', { implementation: () => {} });
    setupMock(logger, 'error', { implementation: () => {} });

    // socketService
    setupMock(socketService, 'emitToCanvas', { implementation: () => {} });

    // commandService
    setupMock(commandService, 'list', { resolvedValue: [] });
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies = [];
  });

  describe('A1: 單一 direct - target idle → 直接執行', () => {
    it('Target Pod 只有 1 條 direct 連線，target 狀態為 idle，應直接執行', async () => {
      // 準備
      setupMock(connectionStore, 'findBySourcePodId', { returnValue: [mockDirectConnection] });
      setupMock(workflowStateService, 'getDirectConnectionCount', { returnValue: 1 });
      setupMock(podStore, 'getById', {
        implementation: (cId: string, podId: string) => {
          if (podId === sourcePodId) return { ...mockSourcePod };
          if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
          return undefined;
        }
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
      setupMock(connectionStore, 'findBySourcePodId', { returnValue: [mockDirectConnection] });
      setupMock(workflowStateService, 'getDirectConnectionCount', { returnValue: 1 });
      setupMock(podStore, 'getById', {
        implementation: (cId: string, podId: string) => {
          if (podId === sourcePodId) return { ...mockSourcePod };
          if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' };
          return undefined;
        }
      });

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue').mockImplementation(() => ({ position: 1, queueSize: 1 }));
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
      setupMock(connectionStore, 'findBySourcePodId', { returnValue: [mockDirectConnection] });
      setupMock(workflowStateService, 'getDirectConnectionCount', { returnValue: 2 });
      setupMock(directTriggerStore, 'hasDirectPending', { returnValue: false }); // 第一次，pending 不存在

      const setTimeoutSpy = spyOn(global, 'setTimeout').mockReturnValue(123 as any);
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
      setupMock(connectionStore, 'findBySourcePodId', { returnValue: [connection2] });
      setupMock(connectionStore, 'getById', { returnValue: connection2 });
      setupMock(workflowStateService, 'getDirectConnectionCount', { returnValue: 2 });
      setupMock(directTriggerStore, 'hasDirectPending', { returnValue: true }); // pending 已存在
      setupMock(directTriggerStore, 'hasActiveTimer', { returnValue: true }); // 有舊 timer

      const setTimeoutSpy = spyOn(global, 'setTimeout').mockReturnValue(123 as any);
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
      setupMock(directTriggerStore, 'getReadySummaries', { returnValue: readySummaries });
      setupMock(connectionStore, 'findByTargetPodId', { returnValue: [mockDirectConnection] });
      setupMock(podStore, 'getById', {
        implementation: (cId: string, podId: string) => {
          if (podId === sourcePodId) return { ...mockSourcePod };
          if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
          return undefined;
        }
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
      setupMock(directTriggerStore, 'getReadySummaries', { returnValue: readySummaries });
      setupMock(connectionStore, 'findByTargetPodId', { returnValue: [mockDirectConnection, connection2] });
      setupMock(podStore, 'getById', {
        implementation: (cId: string, podId: string) => {
          if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
          if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
          return undefined;
        }
      });

      // Mock triggerWorkflowWithSummary 避免執行完整工作流
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

      // 驗證 triggerWorkflowWithSummary 只呼叫 1 次（用合併內容）
      expect(triggerCallCount).toBe(1);

      // 驗證 emitWorkflowComplete 為「非主要」連線被呼叫
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
      setupMock(directTriggerStore, 'getReadySummaries', { returnValue: readySummaries });
      setupMock(connectionStore, 'findByTargetPodId', { returnValue: [mockDirectConnection, connection2] });
      setupMock(directTriggerStore, 'hasDirectPending', { returnValue: false }); // target 不在 direct pending 狀態
      setupMock(podStore, 'getById', {
        implementation: (cId: string, podId: string) => {
          if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
          if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' }; // target busy
          return undefined;
        }
      });

      const enqueueSpy = spyOn(workflowQueueService, 'enqueue').mockImplementation(() => ({ position: 1, queueSize: 1 }));
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
