// Import 真實模組
import { workflowExecutionService } from '../../src/services/workflow';
import { workflowDirectTriggerService } from '../../src/services/workflow/workflowDirectTriggerService.js';
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

  beforeEach(() => {
    // connectionStore
    vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
    vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([]);
    vi.spyOn(connectionStore, 'getById').mockReturnValue(mockDirectConnection);
    vi.spyOn(connectionStore, 'updateDecideStatus').mockImplementation(() => undefined);
    vi.spyOn(connectionStore, 'updateConnectionStatus').mockImplementation(() => undefined);

    // podStore
    vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
      if (podId === sourcePodId) return { ...mockSourcePod };
      if (podId === targetPodId) return { ...mockTargetPod };
      return undefined;
    }) as any);
    vi.spyOn(podStore, 'setStatus').mockImplementation(() => {});
    vi.spyOn(podStore, 'updateLastActive').mockImplementation(() => {});

    // messageStore
    vi.spyOn(messageStore, 'getMessages').mockReturnValue(mockMessages as any);
    vi.spyOn(messageStore, 'addMessage').mockResolvedValue(undefined as any);
    vi.spyOn(messageStore, 'upsertMessage').mockImplementation(() => {});
    vi.spyOn(messageStore, 'flushWrites').mockResolvedValue(undefined);

    // summaryService
    vi.spyOn(summaryService, 'generateSummaryForTarget').mockResolvedValue({
      targetPodId: '',
      success: true,
      summary: testSummary,
    });

    // directTriggerStore
    vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(false);
    vi.spyOn(directTriggerStore, 'initializeDirectPending').mockImplementation(() => {});
    vi.spyOn(directTriggerStore, 'recordDirectReady').mockReturnValue(1);
    vi.spyOn(directTriggerStore, 'clearDirectPending').mockImplementation(() => {});
    vi.spyOn(directTriggerStore, 'hasActiveTimer').mockReturnValue(false);
    vi.spyOn(directTriggerStore, 'clearTimer').mockImplementation(() => {});
    vi.spyOn(directTriggerStore, 'setTimer').mockImplementation(() => {});
    vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(null);

    // workflowStateService
    vi.spyOn(workflowStateService, 'checkMultiInputScenario').mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });
    vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
    vi.spyOn(workflowStateService, 'initializePendingTarget').mockImplementation(() => {});
    vi.spyOn(workflowStateService, 'recordSourceCompletion').mockReturnValue({
      allSourcesResponded: false,
      hasRejection: false,
    });
    vi.spyOn(workflowStateService, 'recordSourceRejection').mockImplementation(() => {});
    vi.spyOn(workflowStateService, 'getCompletedSummaries').mockReturnValue(null);
    vi.spyOn(workflowStateService, 'clearPendingTarget').mockImplementation(() => {});

    // workflowEventEmitter
    vi.spyOn(workflowEventEmitter, 'emitWorkflowAutoTriggered').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitWorkflowTriggered').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitWorkflowComplete').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitAiDecidePending').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitAiDecideResult').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitAiDecideError').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitWorkflowQueued').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitWorkflowQueueProcessed').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitDirectTriggered').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitDirectWaiting').mockImplementation(() => {});
    vi.spyOn(workflowEventEmitter, 'emitDirectMerged').mockImplementation(() => {});

    // claudeQueryService
    (vi.spyOn(claudeQueryService, 'sendMessage') as any).mockImplementation(async (...args: any[]) => {
      const callback = args[2] as any;
      callback({ type: 'text', content: 'Claude response' });
      callback({ type: 'complete' });
    });

    // autoClearService
    vi.spyOn(autoClearService, 'initializeWorkflowTracking').mockImplementation(() => {});
    vi.spyOn(autoClearService, 'onPodComplete').mockResolvedValue(undefined);

    // logger
    vi.spyOn(logger, 'log').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    // socketService
    vi.spyOn(socketService, 'emitToCanvas').mockImplementation(() => {});

    // commandService
    vi.spyOn(commandService, 'list').mockResolvedValue([]);
  });

  afterEach(() => {
    // 清理 pendingResolvers
    (workflowDirectTriggerService as any).pendingResolvers.clear();
    vi.restoreAllMocks();
  });

  describe('A1: 單一 direct - target idle → 直接執行', () => {
    it('Target Pod 只有 1 條 direct 連線，target 狀態為 idle，應直接執行', async () => {
      // 準備
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
      vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
      vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return undefined;
      }) as any);

      // Mock triggerWorkflowInternal 避免執行完整工作流（單一來源會走這個方法）
      const triggerSpy = vi.spyOn(workflowExecutionService, 'triggerWorkflowInternal').mockResolvedValue(undefined);

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

      // 驗證 triggerWorkflowInternal 被呼叫
      expect(triggerSpy).toHaveBeenCalledWith(
        canvasId,
        mockDirectConnection.id
      );
    });
  });

  describe('A2: 單一 direct - target busy → 進 queue', () => {
    it('Target Pod 只有 1 條 direct 連線，target 狀態為 chatting，應進入 queue', async () => {
      // 準備
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
      vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(1);
      vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' };
        return undefined;
      }) as any);

      const enqueueSpy = vi.spyOn(workflowQueueService, 'enqueue').mockImplementation(() => ({ position: 1, queueSize: 1 }));

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
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([mockDirectConnection]);
      vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
      vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(false); // 第一次，pending 不存在

      // 使用 fake timers 來控制 setTimeout
      vi.useFakeTimers();

      // 執行（不 await，因為會卡在 Promise）
      const promise = workflowExecutionService.checkAndTriggerWorkflows(canvasId, sourcePodId);

      // 使用 vi.runAllTimersAsync 讓所有同步代碼執行完畢（但不執行 setTimeout callback）
      // 實際上我們只需要等待微任務執行
      await Promise.resolve();
      await Promise.resolve();

      // 驗證（此時已經執行到設定 timer 的步驟）
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

      // 驗證 directTriggerStore.setTimer 被呼叫
      expect(directTriggerStore.setTimer).toHaveBeenCalled();

      // 清理
      vi.useRealTimers();
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

      // 準備：先設定第一個 source 的 resolver（模擬已有 pending 狀態）
      let firstResolver: any;
      (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
        firstResolver = result;
      });

      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([connection2]);
      vi.spyOn(connectionStore, 'getById').mockReturnValue(connection2);
      vi.spyOn(workflowStateService, 'getDirectConnectionCount').mockReturnValue(2);
      vi.spyOn(directTriggerStore, 'hasDirectPending').mockReturnValue(true); // pending 已存在
      vi.spyOn(directTriggerStore, 'hasActiveTimer').mockReturnValue(true); // 有舊 timer

      // Mock setTimeout 讓它不要真的執行
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => 123 as any);

      // 執行（第二個 source 會回傳 { ready: false }，所以會立即完成）
      await workflowExecutionService.checkAndTriggerWorkflows(canvasId, source2PodId);

      // 驗證
      expect(directTriggerStore.recordDirectReady).toHaveBeenCalledWith(targetPodId, source2PodId, testSummary);
      expect(directTriggerStore.clearTimer).toHaveBeenCalledWith(targetPodId); // 舊 timer 被清除
      expect(setTimeoutSpy).toHaveBeenCalled(); // 新 timer 被設定
      expect(directTriggerStore.setTimer).toHaveBeenCalled();
      expect(workflowEventEmitter.emitDirectWaiting).toHaveBeenCalledTimes(1); // 發送 waiting 事件
    });
  });

  describe('B3: Timer 到期 - 單源, target idle → 執行', () => {
    it('只有 1 個 source ready，timer 到期，target idle，應執行工作流', async () => {
      // 準備 - 模擬 timer 到期時的狀態
      const readySummaries = new Map([[sourcePodId, testSummary]]);
      vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
      vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection]);
      vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
        if (podId === sourcePodId) return { ...mockSourcePod };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return undefined;
      }) as any);

      // 手動設定 pendingResolvers
      let resolvedResult: any;
      (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
        resolvedResult = result;
      });

      // 直接呼叫 onTimerExpired（透過反射訪問私有方法）
      (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

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

      // 驗證 resolver 被呼叫且回傳 ready: true
      expect(resolvedResult).toEqual({ ready: true });

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
      vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
      vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
      vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
        if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'idle' };
        return undefined;
      }) as any);

      // 手動設定 pendingResolvers
      let resolvedResult: any;
      (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
        resolvedResult = result;
      });

      // 執行
      (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

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

      // 驗證 resolver 被呼叫且回傳 ready: true 和 mergedContent
      expect(resolvedResult).toEqual({
        ready: true,
        mergedContent: expect.any(String),
        isSummarized: true,
      });

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

  describe('B5: Timer 到期 - 多源合併 → 回傳 ready: true（Pipeline 後續會處理 enqueue）', () => {
    it('2 個 source ready，timer 到期，onTimerExpired 應回傳 ready: true 和合併內容', async () => {
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
      vi.spyOn(directTriggerStore, 'getReadySummaries').mockReturnValue(readySummaries);
      vi.spyOn(connectionStore, 'findByTargetPodId').mockReturnValue([mockDirectConnection, connection2]);
      vi.spyOn(podStore, 'getById').mockImplementation(((cId: string, podId: string) => {
        if (podId === sourcePodId || podId === source2PodId) return { ...mockSourcePod, id: podId };
        if (podId === targetPodId) return { ...mockTargetPod, status: 'chatting' }; // target busy
        return undefined;
      }) as any);

      // 手動設定 pendingResolvers
      let resolvedResult: any;
      (workflowDirectTriggerService as any).pendingResolvers.set(targetPodId, (result: any) => {
        resolvedResult = result;
      });

      // 執行
      (workflowDirectTriggerService as any).onTimerExpired(canvasId, targetPodId);

      // 驗證
      expect(workflowEventEmitter.emitDirectMerged).toHaveBeenCalled();

      // 驗證所有 direct connections 都發送了 emitDirectTriggered
      expect(workflowEventEmitter.emitDirectTriggered).toHaveBeenCalledTimes(2);

      // 驗證 resolver 被呼叫且回傳 ready: true 和 mergedContent
      // Pipeline 的後續 checkQueue 階段會根據 target Pod 狀態決定是否 enqueue
      expect(resolvedResult).toEqual({
        ready: true,
        mergedContent: expect.any(String),
        isSummarized: true,
      });

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
});
