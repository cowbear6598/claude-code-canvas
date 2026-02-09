import type {
  WorkflowDirectTriggeredPayload,
  WorkflowDirectWaitingPayload,
  Connection,
} from '../../types/index.js';
import type {
  TriggerStrategy,
  TriggerDecideContext,
  TriggerDecideResult,
  CollectSourcesContext,
  CollectSourcesResult,
} from './types.js';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {directTriggerStore} from '../directTriggerStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries} from './workflowHelpers.js';

class WorkflowDirectTriggerService implements TriggerStrategy {
  readonly mode = 'direct' as const;

  // 用於管理等待中的 Promise resolvers
  private pendingResolvers: Map<string, (result: CollectSourcesResult) => void> = new Map();

  // 超時時間（30 秒）
  private readonly MAX_PENDING_TIME = 30000;

  /**
   * decide 階段：Direct 模式永遠批准所有連線
   */
  async decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]> {
    return context.connections.map((connection) => ({
      connectionId: connection.id,
      approved: true,
      reason: null,
    }));
  }

  /**
   * collectSources 階段：封裝 10 秒倒數 + 合併邏輯
   */
  async collectSources(context: CollectSourcesContext): Promise<CollectSourcesResult> {
    const { canvasId, sourcePodId, connection, summary } = context;
    const targetPodId = connection.targetPodId;

    const directCount = workflowStateService.getDirectConnectionCount(canvasId, targetPodId);

    // 單一來源：直接發送 DIRECT_TRIGGERED 事件，回傳 ready=true
    if (directCount === 1) {
      const payload: WorkflowDirectTriggeredPayload = {
        canvasId,
        connectionId: connection.id,
        sourcePodId,
        targetPodId,
        transferredContent: summary,
        isSummarized: true,
      };

      workflowEventEmitter.emitDirectTriggered(canvasId, payload);

      logger.log('Workflow', 'Create', `Direct trigger from Pod ${sourcePodId} to Pod ${targetPodId}`);

      return { ready: true };
    }

    // 多來源：10 秒倒數邏輯

    // 初始化 directPending
    if (!directTriggerStore.hasDirectPending(targetPodId)) {
      directTriggerStore.initializeDirectPending(targetPodId);

      const targetPod = podStore.getById(canvasId, targetPodId);
      if (targetPod && targetPod.status === 'idle') {
        podStore.setStatus(canvasId, targetPodId, 'chatting');
      }
    }

    directTriggerStore.recordDirectReady(targetPodId, sourcePodId, summary);

    // 發送 WAITING 事件
    const directWaitingPayload: WorkflowDirectWaitingPayload = {
      canvasId,
      connectionId: connection.id,
      sourcePodId,
      targetPodId,
    };
    workflowEventEmitter.emitDirectWaiting(canvasId, directWaitingPayload);

    const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
    const readySourcePodIds = readySummaries ? Array.from(readySummaries.keys()) : [];

    logger.log('Workflow', 'Update', `Multi-direct trigger: ${readySourcePodIds.length} sources ready for target ${targetPodId}, countdown started`);

    // 檢查是否已有等待中的 resolver
    const existingResolver = this.pendingResolvers.has(targetPodId);

    if (existingResolver) {
      // 後續 source：重設計時器，回傳 { ready: false }
      this.startCountdownTimer(canvasId, targetPodId);
      return { ready: false };
    }

    // 第一個 source：建立 Promise 等待
    return new Promise<CollectSourcesResult>((resolve) => {
      this.pendingResolvers.set(targetPodId, resolve);
      this.startCountdownTimer(canvasId, targetPodId);

      // 超時清理機制
      setTimeout(() => {
        if (this.pendingResolvers.has(targetPodId)) {
          logger.error('Workflow', 'Error', `Direct trigger 超時未完成，清理 ${targetPodId}`);
          this.pendingResolvers.delete(targetPodId);
          directTriggerStore.clearDirectPending(targetPodId);
          resolve({ ready: false });
        }
      }, this.MAX_PENDING_TIME);
    });
  }

  /**
   * 啟動或重設倒數計時器
   */
  private startCountdownTimer(canvasId: string, targetPodId: string): void {
    if (directTriggerStore.hasActiveTimer(targetPodId)) {
      directTriggerStore.clearTimer(targetPodId);
    }

    const timer = setTimeout(() => {
      this.onTimerExpired(canvasId, targetPodId);
    }, 10000);

    directTriggerStore.setTimer(targetPodId, timer);
  }

  /**
   * 計時器到期處理
   */
  private onTimerExpired(canvasId: string, targetPodId: string): void {
    const resolver = this.pendingResolvers.get(targetPodId);
    if (!resolver) {
      return;
    }

    let resolverCalled = false;

    try {
      const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
      if (!readySummaries || readySummaries.size === 0) {
        resolver({ ready: false });
        resolverCalled = true;
        return;
      }

      const sourcePodIds = Array.from(readySummaries.keys());
      const incomingConnections = connectionStore.findByTargetPodId(canvasId, targetPodId);

      // 處理單一來源的情況（在倒數期間其他來源都已完成）
      if (sourcePodIds.length === 1) {
        const [singleSourcePodId] = sourcePodIds;
        const singleSummary = readySummaries.get(singleSourcePodId)!;

        const directConnection = incomingConnections.find(
          (conn) => conn.triggerMode === 'direct' && conn.sourcePodId === singleSourcePodId
        );

        if (directConnection) {
          const payload: WorkflowDirectTriggeredPayload = {
            canvasId,
            connectionId: directConnection.id,
            sourcePodId: singleSourcePodId,
            targetPodId,
            transferredContent: singleSummary,
            isSummarized: true,
          };
          workflowEventEmitter.emitDirectTriggered(canvasId, payload);
        }

        resolver({ ready: true });
        resolverCalled = true;
        return;
      }

      // 合併多個來源的摘要
      const mergedContent = formatMergedSummaries(
        readySummaries,
        (podId) => podStore.getById(canvasId, podId)
      );

      // 發送 DIRECT_MERGED 事件
      const mergedPayload = {
        canvasId,
        targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedContent.substring(0, 200),
        countdownSeconds: 0,
      };

      workflowEventEmitter.emitDirectMerged(canvasId, mergedPayload);

      // 找出所有涉及的 direct connections
      const directConnections = incomingConnections.filter(
        (conn) => conn.triggerMode === 'direct' && sourcePodIds.includes(conn.sourcePodId)
      );

      // 為所有參與合併的 direct connections 發送 WORKFLOW_DIRECT_TRIGGERED 事件
      for (const conn of directConnections) {
        const summary = readySummaries.get(conn.sourcePodId);
        if (summary) {
          const payload: WorkflowDirectTriggeredPayload = {
            canvasId,
            connectionId: conn.id,
            sourcePodId: conn.sourcePodId,
            targetPodId,
            transferredContent: mergedContent,
            isSummarized: true,
          };
          workflowEventEmitter.emitDirectTriggered(canvasId, payload);
        }
      }

      // 為其他 connections 發送 WORKFLOW_COMPLETE 事件（除了第一個用來觸發的）
      const anyDirectConnection = directConnections[0];
      if (anyDirectConnection) {
        const allDirectConnectionIds = directConnections.map(conn => conn.id);
        const otherConnectionIds = allDirectConnectionIds.filter(id => id !== anyDirectConnection.id);

        for (const otherConnectionId of otherConnectionIds) {
          const otherConnection = directConnections.find(conn => conn.id === otherConnectionId);
          if (otherConnection) {
            workflowEventEmitter.emitWorkflowComplete(
              canvasId,
              otherConnectionId,
              otherConnection.sourcePodId,
              targetPodId,
              true,
              undefined,
              'direct'
            );
          }
        }
      }

      resolver({ ready: true, mergedContent, isSummarized: true });
      resolverCalled = true;
    } catch (error) {
      logger.error('Workflow', 'Error', `Direct trigger timer 處理失敗: ${targetPodId}`, error);
      if (!resolverCalled) {
        resolver({ ready: false });
      }
    } finally {
      // 確保清理
      this.pendingResolvers.delete(targetPodId);
      directTriggerStore.clearDirectPending(targetPodId);
    }
  }

  /**
   * 清理指定 targetPodId 的所有等待狀態（Pod 刪除時呼叫）
   */
  public cleanupPendingTarget(targetPodId: string): void {
    const resolver = this.pendingResolvers.get(targetPodId);
    if (resolver) {
      resolver({ ready: false });
      this.pendingResolvers.delete(targetPodId);
    }

    if (directTriggerStore.hasActiveTimer(targetPodId)) {
      directTriggerStore.clearTimer(targetPodId);
    }

    directTriggerStore.clearDirectPending(targetPodId);

    logger.log('Workflow', 'Update', `已清理 target ${targetPodId} 的 Direct trigger 等待狀態`);
  }
}

export const workflowDirectTriggerService = new WorkflowDirectTriggerService();
