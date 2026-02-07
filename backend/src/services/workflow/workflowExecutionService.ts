import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents} from '../../schemas';
import type {
    PodChatCompletePayload,
    PodChatMessagePayload,
    PodChatToolResultPayload,
    PodChatToolUsePayload,
    WorkflowAutoTriggeredPayload,
    WorkflowPendingPayload,
    WorkflowSourcesMergedPayload,
    WorkflowDirectTriggeredPayload,
    WorkflowDirectWaitingPayload,
    Connection,
} from '../../types';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {claudeQueryService} from '../claude/queryService.js';
import {socketService} from '../socketService.js';
import {summaryService} from '../summaryService.js';
import {pendingTargetStore} from '../pendingTargetStore.js';
import {directTriggerStore} from '../directTriggerStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {workflowQueueService} from './workflowQueueService.js';
import {autoClearService} from '../autoClear/index.js';
import {logger} from '../../utils/logger.js';
import {commandService} from '../commandService.js';
import {aiDecideService} from './aiDecideService.js';
import {
    createSubMessageState,
    createSubMessageFlusher,
    processTextEvent,
    processToolUseEvent,
    processToolResultEvent,
} from '../claude/streamEventProcessor.js';
import {
    formatMergedSummaries,
    buildTransferMessage,
    buildMessageWithCommand,
} from './workflowHelpers.js';

class WorkflowExecutionService {

  private getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      logger.error('Workflow', 'Error', 'No assistant messages available for fallback');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }

  private async generateSummaryWithFallback(
    canvasId: string,
    sourcePodId: string,
    targetPodId: string
  ): Promise<{ content: string; isSummarized: boolean } | null> {
    try {
      podStore.setStatus(canvasId, sourcePodId, 'summarizing');
      const sourcePod = podStore.getById(canvasId, sourcePodId);
      const targetPod = podStore.getById(canvasId, targetPodId);
      logger.log('Workflow', 'Create', `Generating customized summary for source POD "${sourcePod?.name ?? sourcePodId}" to target POD "${targetPod?.name ?? targetPodId}"`);
      const summaryResult = await summaryService.generateSummaryForTarget(
        canvasId,
        sourcePodId,
        targetPodId
      );

      if (summaryResult.success) {
        podStore.setStatus(canvasId, sourcePodId, 'idle');
        return { content: summaryResult.summary, isSummarized: true };
      }

      logger.error('Workflow', 'Error', `Failed to generate summary: ${summaryResult.error}`);
      const fallback = this.getLastAssistantMessage(sourcePodId);
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return fallback ? { content: fallback, isSummarized: false } : null;
    } catch (error) {
      logger.error('Workflow', 'Error', 'Failed to generate summary', error);
      const fallback = this.getLastAssistantMessage(sourcePodId);
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return fallback ? { content: fallback, isSummarized: false } : null;
    }
  }

  private async processAutoTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summaryContentRef: { value: string | null }
  ): Promise<void> {
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (!targetPod) {
      logger.log('Workflow', 'Error', `Target Pod ${connection.targetPodId} not found, skipping auto-trigger`);
      return;
    }

    const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
      canvasId,
      connection.targetPodId
    );

    if (isMultiInput) {
      await this.handleMultiInputScenario(
        canvasId,
        sourcePodId,
        connection,
        requiredSourcePodIds,
        summaryContentRef
      );
      return;
    }

    if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${targetPod.status}, enqueuing auto-trigger`);

      if (!summaryContentRef.value) {
        const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, connection.targetPodId);
        if (!result) {
          return;
        }
        summaryContentRef.value = result.content;
      }

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId,
        targetPodId: connection.targetPodId,
        summary: summaryContentRef.value,
        isSummarized: true,
        triggerMode: 'auto',
      });
      return;
    }

    this.triggerWorkflowInternal(canvasId, connection.id).catch((error) => {
      logger.error('Workflow', 'Error', `Failed to auto-trigger workflow ${connection.id}`, error);
    });
  }

  private async handleMultiInputScenario(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    requiredSourcePodIds: string[],
    summaryContentRef: { value: string | null }
  ): Promise<void> {
    if (!summaryContentRef.value) {
      const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, connection.targetPodId);
      if (!result) {
        return;
      }
      summaryContentRef.value = result.content;
    }

    if (!pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
      workflowStateService.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
    }

    const { allSourcesResponded, hasRejection } = workflowStateService.recordSourceCompletion(
      connection.targetPodId,
      sourcePodId,
      summaryContentRef.value
    );

    if (!allSourcesResponded) {
      this.emitPendingStatus(canvasId, connection.targetPodId);
      return;
    }

    // 如果有任何來源被 rejected，則永遠不觸發
    if (hasRejection) {
      logger.log('Workflow', 'Update', `Target ${connection.targetPodId} has rejected sources, not triggering`);
      this.emitPendingStatus(canvasId, connection.targetPodId);
      return;
    }

    const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
    if (!completedSummaries) {
      logger.error('Workflow', 'Error', 'Failed to get completed summaries');
      return;
    }

    const mergedContent = formatMergedSummaries(
      completedSummaries,
      (podId) => podStore.getById(canvasId, podId)
    );

    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${targetPod.status}, enqueuing merged workflow`);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId: Array.from(completedSummaries.keys())[0],
        targetPodId: connection.targetPodId,
        summary: mergedContent,
        isSummarized: true,
        triggerMode: 'auto',
      });

      workflowStateService.clearPendingTarget(connection.targetPodId);
      return;
    }

    this.triggerMergedWorkflow(canvasId, connection);
  }

  private emitPendingStatus(canvasId: string, targetPodId: string): void {
    const pending = pendingTargetStore.getPendingTarget(targetPodId);
    if (!pending) {
      return;
    }

    const completedSourcePodIds = Array.from(pending.completedSources.keys());
    const rejectedSourcePodIds = Array.from(pending.rejectedSources.keys());
    const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
      (id) => !completedSourcePodIds.includes(id) && !rejectedSourcePodIds.includes(id)
    );

    const pendingPayload: WorkflowPendingPayload = {
      canvasId,
      targetPodId,
      completedSourcePodIds,
      pendingSourcePodIds,
      totalSources: pending.requiredSourcePodIds.length,
      completedCount: pending.completedSources.size,
      rejectedSourcePodIds,
      hasRejectedSources: rejectedSourcePodIds.length > 0,
    };

    socketService.emitToCanvas(
      canvasId,
      WebSocketResponseEvents.WORKFLOW_PENDING,
      pendingPayload
    );

    logger.log('Workflow', 'Update', `Target ${targetPodId} waiting: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources complete`);
  }

  private triggerMergedWorkflow(canvasId: string, connection: Connection): void {
    logger.log('Workflow', 'Complete', `All sources complete for target ${connection.targetPodId}`);

    const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
    if (!completedSummaries) {
      logger.error('Workflow', 'Error', 'Failed to get completed summaries');
      return;
    }

    podStore.setStatus(canvasId, connection.targetPodId, 'chatting');

    const mergedContent = formatMergedSummaries(
      completedSummaries,
      (podId) => podStore.getById(canvasId, podId)
    );
    const mergedPreview = mergedContent.substring(0, 200);

    const sourcePodIds = Array.from(completedSummaries.keys());
    const mergedPayload: WorkflowSourcesMergedPayload = {
      canvasId,
      targetPodId: connection.targetPodId,
      sourcePodIds,
      mergedContentPreview: mergedPreview,
    };

    socketService.emitToCanvas(
      canvasId,
      WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
      mergedPayload
    );

    this.triggerWorkflowWithSummary(canvasId, connection.id, mergedContent, true).catch((error) => {
      logger.error('Workflow', 'Error', `Failed to trigger merged workflow ${connection.id}`, error);
    });

    workflowStateService.clearPendingTarget(connection.targetPodId);
  }

  /**
   * 處理 AI Decide connections 的批次判斷和觸發
   */
  private async processAiDecideConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<void> {
    try {
      // 1. 發送 PENDING 事件
      const connectionIds = connections.map(conn => conn.id);
      workflowEventEmitter.emitAiDecidePending(canvasId, connectionIds, sourcePodId);

      // 2. 更新所有 connections 狀態為 pending
      for (const conn of connections) {
        connectionStore.updateDecideStatus(canvasId, conn.id, 'pending', null);
      }

      // 3. 呼叫 AI Decide Service
      const batchResult = await aiDecideService.decideConnections(canvasId, sourcePodId, connections);

      // 4. 處理成功的判斷結果
      for (const result of batchResult.results) {
        const conn = connections.find(c => c.id === result.connectionId);
        if (!conn) continue;

        if (result.shouldTrigger) {
          connectionStore.updateDecideStatus(canvasId, result.connectionId, 'approved', result.reason);

          workflowEventEmitter.emitAiDecideResult(
            canvasId,
            result.connectionId,
            sourcePodId,
            conn.targetPodId,
            true,
            result.reason
          );

          logger.log('Workflow', 'Create', `AI Decide approved connection ${result.connectionId}: ${result.reason}`);

          const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
            canvasId,
            conn.targetPodId
          );

          if (!isMultiInput) {
            const targetPod = podStore.getById(canvasId, conn.targetPodId);
            if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
              const summaryResult = await this.generateSummaryWithFallback(canvasId, sourcePodId, conn.targetPodId);
              if (summaryResult) {
                workflowQueueService.enqueue({
                  canvasId,
                  connectionId: conn.id,
                  sourcePodId,
                  targetPodId: conn.targetPodId,
                  summary: summaryResult.content,
                  isSummarized: summaryResult.isSummarized,
                  triggerMode: 'ai-decide',
                });
              }
            } else {
              this.triggerWorkflowInternal(canvasId, conn.id).catch((error) => {
                logger.error('Workflow', 'Error', `Failed to trigger AI-decided workflow ${conn.id}`, error);
              });
            }
          } else {
            const summaryResult = await this.generateSummaryWithFallback(canvasId, sourcePodId, conn.targetPodId);
            if (summaryResult) {
              if (!pendingTargetStore.hasPendingTarget(conn.targetPodId)) {
                workflowStateService.initializePendingTarget(conn.targetPodId, requiredSourcePodIds);
              }

              const { allSourcesResponded, hasRejection } = workflowStateService.recordSourceCompletion(
                conn.targetPodId,
                sourcePodId,
                summaryResult.content
              );

              if (!allSourcesResponded) {
                this.emitPendingStatus(canvasId, conn.targetPodId);
                return;
              }

              if (hasRejection) {
                logger.log('Workflow', 'Update', `Target ${conn.targetPodId} has rejected sources, not triggering`);
                this.emitPendingStatus(canvasId, conn.targetPodId);
                return;
              }

              const completedSummaries = workflowStateService.getCompletedSummaries(conn.targetPodId);
              if (!completedSummaries) {
                logger.error('Workflow', 'Error', 'Failed to get completed summaries');
                return;
              }

              const mergedContent = formatMergedSummaries(
                completedSummaries,
                (podId) => podStore.getById(canvasId, podId)
              );

              const targetPod = podStore.getById(canvasId, conn.targetPodId);
              if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
                logger.log('Workflow', 'Update', `Target Pod ${conn.targetPodId} is ${targetPod.status}, enqueuing merged workflow (AI Decide)`);

                workflowQueueService.enqueue({
                  canvasId,
                  connectionId: conn.id,
                  sourcePodId: Array.from(completedSummaries.keys())[0],
                  targetPodId: conn.targetPodId,
                  summary: mergedContent,
                  isSummarized: true,
                  triggerMode: 'ai-decide',
                });

                workflowStateService.clearPendingTarget(conn.targetPodId);
                return;
              }

              this.triggerMergedWorkflow(canvasId, conn);
            }
          }
        } else {
          // Rejected - 不觸發
          connectionStore.updateDecideStatus(canvasId, result.connectionId, 'rejected', result.reason);

          workflowEventEmitter.emitAiDecideResult(
            canvasId,
            result.connectionId,
            sourcePodId,
            conn.targetPodId,
            false,
            result.reason
          );

          logger.log('Workflow', 'Update', `AI Decide rejected connection ${result.connectionId}: ${result.reason}`);

          // 若 target Pod 在多輸入場景中，記錄 rejection
          const { isMultiInput } = workflowStateService.checkMultiInputScenario(canvasId, conn.targetPodId);
          if (isMultiInput && pendingTargetStore.hasPendingTarget(conn.targetPodId)) {
            workflowStateService.recordSourceRejection(conn.targetPodId, sourcePodId, result.reason);
            this.emitPendingStatus(canvasId, conn.targetPodId);
          }
        }
      }

      // 5. 處理錯誤結果
      for (const errorResult of batchResult.errors) {
        const conn = connections.find(c => c.id === errorResult.connectionId);
        if (!conn) continue;

        connectionStore.updateDecideStatus(canvasId, errorResult.connectionId, 'error', errorResult.error);

        workflowEventEmitter.emitAiDecideError(
          canvasId,
          errorResult.connectionId,
          sourcePodId,
          conn.targetPodId,
          errorResult.error
        );

        logger.error('Workflow', 'Error', `AI Decide error for connection ${errorResult.connectionId}: ${errorResult.error}`);
      }
    } catch (error) {
      logger.error('Workflow', 'Error', '[processAiDecideConnections] Unexpected error', error);

      // 所有 connections 標記為 error
      for (const conn of connections) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        connectionStore.updateDecideStatus(canvasId, conn.id, 'error', errorMessage);

        workflowEventEmitter.emitAiDecideError(
          canvasId,
          conn.id,
          sourcePodId,
          conn.targetPodId,
          errorMessage
        );
      }
    }
  }

  async checkAndTriggerWorkflows(canvasId: string, sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(canvasId, sourcePodId);
    const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
    const aiDecideConnections = connections.filter((conn) => conn.triggerMode === 'ai-decide');
    const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

    if (autoConnections.length === 0 && aiDecideConnections.length === 0 && directConnections.length === 0) {
      return;
    }

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    logger.log('Workflow', 'Create', `Found ${autoConnections.length} auto, ${aiDecideConnections.length} ai-decide, and ${directConnections.length} direct connections for Pod "${sourcePod?.name ?? sourcePodId}"`);

    autoClearService.initializeWorkflowTracking(canvasId, sourcePodId);

    const summaryContentRef = { value: null as string | null };

    await Promise.all([
      (async (): Promise<void> => {
        for (const connection of autoConnections) {
          await this.processAutoTriggerConnection(canvasId, sourcePodId, connection, summaryContentRef);
        }
      })(),
      aiDecideConnections.length > 0
        ? this.processAiDecideConnections(canvasId, sourcePodId, aiDecideConnections)
        : Promise.resolve(),
      directConnections.length > 0
        ? this.processDirectConnections(canvasId, sourcePodId, directConnections)
        : Promise.resolve(),
    ]);
  }

  private async processDirectConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<void> {
    for (const connection of connections) {
      await this.processDirectTriggerConnection(canvasId, sourcePodId, connection);
    }
  }

  private async processDirectTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection
  ): Promise<void> {
    const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, connection.targetPodId);
    if (!result) {
      return;
    }

    const directCount = workflowStateService.getDirectConnectionCount(canvasId, connection.targetPodId);

    if (directCount === 1) {
      await this.handleSingleDirectTrigger(canvasId, sourcePodId, connection, result.content, result.isSummarized);
    } else {
      await this.handleMultiDirectTrigger(canvasId, sourcePodId, connection, result.content, result.isSummarized);
    }
  }

  private async handleSingleDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    isSummarized: boolean
  ): Promise<void> {
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (!targetPod) {
      return;
    }

    if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is busy, enqueuing direct trigger`);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId,
        targetPodId: connection.targetPodId,
        summary,
        isSummarized,
        triggerMode: 'direct',
      });
      return;
    }

    const payload: WorkflowDirectTriggeredPayload = {
      canvasId,
      connectionId: connection.id,
      sourcePodId,
      targetPodId: connection.targetPodId,
      transferredContent: summary,
      isSummarized,
    };

    workflowEventEmitter.emitDirectTriggered(canvasId, payload);

    logger.log('Workflow', 'Create', `Direct trigger from Pod ${sourcePodId} to Pod ${connection.targetPodId}`);

    await this.triggerWorkflowWithSummary(canvasId, connection.id, summary, isSummarized, true);
  }

  private async handleMultiDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    _isSummarized: boolean
  ): Promise<void> {
    const targetPodId = connection.targetPodId;

    if (!directTriggerStore.hasDirectPending(targetPodId)) {
      directTriggerStore.initializeDirectPending(targetPodId);

      const targetPod = podStore.getById(canvasId, targetPodId);
      if (targetPod && targetPod.status === 'idle') {
        podStore.setStatus(canvasId, targetPodId, 'chatting');
      }
    }

    directTriggerStore.recordDirectReady(targetPodId, sourcePodId, summary);

    // 發送 WORKFLOW_DIRECT_WAITING 事件，讓連線進入 waiting 狀態
    const directWaitingPayload: WorkflowDirectWaitingPayload = {
      canvasId,
      connectionId: connection.id,
      sourcePodId,
      targetPodId: connection.targetPodId,
    };
    workflowEventEmitter.emitDirectWaiting(canvasId, directWaitingPayload);

    if (directTriggerStore.hasActiveTimer(targetPodId)) {
      directTriggerStore.clearTimer(targetPodId);
    }

    const timer = setTimeout(() => {
      this.handleDirectTimerExpired(canvasId, targetPodId).catch((error) => {
        logger.error('Workflow', 'Error', `Failed to handle direct timer expired for ${targetPodId}`, error);
      });
    }, 10000);

    directTriggerStore.setTimer(targetPodId, timer);

    const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
    const readySourcePodIds = readySummaries ? Array.from(readySummaries.keys()) : [];

    logger.log('Workflow', 'Update', `Multi-direct trigger: ${readySourcePodIds.length} sources ready for target ${targetPodId}, countdown started`);
  }

  private async handleDirectTimerExpired(canvasId: string, targetPodId: string): Promise<void> {
    const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
    if (!readySummaries || readySummaries.size === 0) {
      directTriggerStore.clearDirectPending(targetPodId);
      return;
    }

    const sourcePodIds = Array.from(readySummaries.keys());
    const incomingConnections = connectionStore.findByTargetPodId(canvasId, targetPodId);

    if (sourcePodIds.length === 1) {
      const [singleSourcePodId] = sourcePodIds;
      const singleSummary = readySummaries.get(singleSourcePodId)!;

      const directConnection = incomingConnections.find(
        (conn) => conn.triggerMode === 'direct' && conn.sourcePodId === singleSourcePodId
      );

      if (directConnection) {
        // 發送 WORKFLOW_DIRECT_TRIGGERED 事件
        const payload: WorkflowDirectTriggeredPayload = {
          canvasId,
          connectionId: directConnection.id,
          sourcePodId: singleSourcePodId,
          targetPodId,
          transferredContent: singleSummary,
          isSummarized: true,
        };
        workflowEventEmitter.emitDirectTriggered(canvasId, payload);

        await this.triggerWorkflowWithSummary(canvasId, directConnection.id, singleSummary, true, true);
      }

      directTriggerStore.clearDirectPending(targetPodId);
      return;
    }

    const mergedContent = formatMergedSummaries(
      readySummaries,
      (podId) => podStore.getById(canvasId, podId)
    );

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

    // 問題 2 修復：記錄所有參與合併的 connectionIds
    const allDirectConnectionIds = directConnections.map(conn => conn.id);
    const anyDirectConnection = directConnections[0];

    if (anyDirectConnection) {
      const targetPod = podStore.getById(canvasId, targetPodId);
      if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
        const isBusyWithDirect = directTriggerStore.hasDirectPending(targetPodId);

        if (!isBusyWithDirect) {
          workflowQueueService.enqueue({
            canvasId,
            connectionId: anyDirectConnection.id,
            sourcePodId: sourcePodIds[0],
            targetPodId,
            summary: mergedContent,
            isSummarized: true,
            triggerMode: 'direct',
          });

          directTriggerStore.clearDirectPending(targetPodId);
          return;
        }
      }

      // 問題 2 修復：觸發工作流並等待完成
      await this.triggerWorkflowWithSummary(canvasId, anyDirectConnection.id, mergedContent, true, true);

      // 問題 2 修復：為其他參與合併的 connections 發送 WORKFLOW_COMPLETE 事件
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

    directTriggerStore.clearDirectPending(targetPodId);
  }

  async triggerWorkflowInternal(canvasId: string, connectionId: string): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      throw new Error(`Pod not found: ${sourcePodId}`);
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
    if (assistantMessages.length === 0) {
      throw new Error(`Source Pod ${sourcePodId} has no assistant messages to transfer`);
    }

    const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, targetPodId);
    if (!result) {
      throw new Error('無可用的備用內容');
    }

    const transferredContent = result.content;
    const isSummarized = result.isSummarized;

    logger.log('Workflow', 'Create', `Auto-triggering workflow from Pod "${sourcePod.name}" to Pod "${targetPod.name}" (summarized: ${isSummarized})`);

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, sourcePodId, targetPodId, autoTriggeredPayload);
    workflowEventEmitter.emitWorkflowTriggered(
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized
    );

    await this.executeClaudeQuery(canvasId, connectionId, sourcePodId, targetPodId, transferredContent);

    this.checkAndTriggerWorkflows(canvasId, targetPodId).catch((error) => {
      logger.error('Workflow', 'Error', `Failed to check auto-trigger workflows for Pod ${targetPodId}`, error);
    });
  }

  async triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    skipAutoTriggeredEvent: boolean = false
  ): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    logger.log('Workflow', 'Create', `Triggering workflow with pre-generated summary from Pod ${sourcePodId} to Pod ${targetPodId}`);

    if (!skipAutoTriggeredEvent) {
      const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
        connectionId,
        sourcePodId,
        targetPodId,
        transferredContent: summary,
        isSummarized,
      };

      workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, sourcePodId, targetPodId, autoTriggeredPayload);
    }

    workflowEventEmitter.emitWorkflowTriggered(
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      summary,
      isSummarized
    );

    await this.executeClaudeQuery(canvasId, connectionId, sourcePodId, targetPodId, summary);

    this.checkAndTriggerWorkflows(canvasId, targetPodId).catch((error) => {
      logger.error('Workflow', 'Error', `Failed to check auto-trigger workflows for Pod ${targetPodId}`, error);
    });
  }

  private async executeClaudeQuery(
    canvasId: string,
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    content: string
  ): Promise<void> {
    podStore.setStatus(canvasId, targetPodId, 'chatting');

    const connection = connectionStore.getById(canvasId, connectionId);
    const triggerMode = connection?.triggerMode ?? 'auto';

    const baseMessage = buildTransferMessage(content);
    const targetPod = podStore.getById(canvasId, targetPodId);
    const commands = await commandService.list();
    const messageToSend = buildMessageWithCommand(baseMessage, targetPod, commands);

    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();
    const accumulatedContentRef = {value: ''};
    const subMessageState = createSubMessageState();
    const flushCurrentSubMessage = createSubMessageFlusher(assistantMessageId, subMessageState);

    try {
      socketService.emitToCanvas(
        canvasId,
        WebSocketResponseEvents.POD_CHAT_USER_MESSAGE,
        {
          canvasId,
          podId: targetPodId,
          messageId: userMessageId,
          content: messageToSend,
          timestamp: new Date().toISOString(),
        }
      );

      await messageStore.addMessage(canvasId, targetPodId, 'user', messageToSend);

      await claudeQueryService.sendMessage(targetPodId, messageToSend, (event) => {
        switch (event.type) {
          case 'text': {
            processTextEvent(event.content, accumulatedContentRef, subMessageState);

            const textPayload: PodChatMessagePayload = {
              canvasId,
              podId: targetPodId,
              messageId: assistantMessageId,
              content: accumulatedContentRef.value,
              isPartial: true,
              role: 'assistant',
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
              textPayload
            );
            break;
          }

          case 'tool_use': {
            processToolUseEvent(
              event.toolUseId,
              event.toolName,
              event.input,
              subMessageState,
              flushCurrentSubMessage
            );

            const toolUsePayload: PodChatToolUsePayload = {
              canvasId,
              podId: targetPodId,
              messageId: assistantMessageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CHAT_TOOL_USE,
              toolUsePayload
            );
            break;
          }

          case 'tool_result': {
            processToolResultEvent(event.toolUseId, event.output, subMessageState);

            const toolResultPayload: PodChatToolResultPayload = {
              canvasId,
              podId: targetPodId,
              messageId: assistantMessageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              output: event.output,
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
              toolResultPayload
            );
            break;
          }

          case 'complete': {
            flushCurrentSubMessage();

            const completePayload: PodChatCompletePayload = {
              canvasId,
              podId: targetPodId,
              messageId: assistantMessageId,
              fullContent: accumulatedContentRef.value,
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CHAT_COMPLETE,
              completePayload
            );
            break;
          }

          case 'error': {
            logger.error('Workflow', 'Error', `Stream error for Pod ${targetPodId}: ${event.error}`);
            break;
          }
        }
      }, 'workflow');

      if (accumulatedContentRef.value || subMessageState.subMessages.length > 0) {
        await messageStore.addMessage(
          canvasId,
          targetPodId,
          'assistant',
          accumulatedContentRef.value,
          subMessageState.subMessages.length > 0 ? subMessageState.subMessages : undefined
        );
      }

      podStore.setStatus(canvasId, targetPodId, 'idle');
      podStore.updateLastActive(canvasId, targetPodId);

      workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, true, undefined, triggerMode);

      logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);

      await autoClearService.onPodComplete(canvasId, targetPodId);

      // 不 await，避免遞迴鏈阻塞呼叫者（如 handleDirectTimerExpired 中 multi-direct 的 complete 事件）
      workflowQueueService.processNextInQueue(canvasId, targetPodId).catch(error => {
        logger.error('Workflow', 'Error', `處理佇列下一項時發生錯誤: ${error}`);
      });
    } catch (error) {
      podStore.setStatus(canvasId, targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      workflowEventEmitter.emitWorkflowComplete(
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        false,
        errorMessage,
        triggerMode
      );

      logger.error('Workflow', 'Error', 'Failed to complete workflow', error);

      // 不 await，避免遞迴鏈阻塞呼叫者（如 handleDirectTimerExpired 中 multi-direct 的 complete 事件）
      workflowQueueService.processNextInQueue(canvasId, targetPodId).catch(error => {
        logger.error('Workflow', 'Error', `處理佇列下一項時發生錯誤: ${error}`);
      });

      throw error;
    }
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
