import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents, SystemConnectionIds} from '../../schemas';
import type {
    WorkflowAutoTriggeredPayload,
    Connection,
} from '../../types';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {socketService} from '../socketService.js';
import {summaryService} from '../summaryService.js';
import {pendingTargetStore} from '../pendingTargetStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {workflowQueueService} from './workflowQueueService.js';
import {autoClearService} from '../autoClear';
import {logger} from '../../utils/logger.js';
import {commandService} from '../commandService.js';
import {aiDecideService} from './aiDecideService.js';
import {executeStreamingChat} from '../claude/streamingChatExecutor.js';
import {
    buildTransferMessage,
    buildMessageWithCommand,
} from './workflowHelpers.js';
import {getErrorMessage} from '../../utils/errorHelpers.js';
import {workflowAutoTriggerService} from './workflowAutoTriggerService.js';
import {workflowMultiInputService} from './workflowMultiInputService.js';
import {workflowDirectTriggerService} from './workflowDirectTriggerService.js';

class WorkflowExecutionService {

  private async generateSummaryWithFallback(
    canvasId: string,
    sourcePodId: string,
    targetPodId: string
  ): Promise<{ content: string; isSummarized: boolean } | null> {
    podStore.setStatus(canvasId, sourcePodId, 'summarizing');
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    const targetPod = podStore.getById(canvasId, targetPodId);
    logger.log('Workflow', 'Create', `Generating customized summary for source POD "${sourcePod?.name ?? sourcePodId}" to target POD "${targetPod?.name ?? targetPodId}"`);

    let summaryResult: Awaited<ReturnType<typeof summaryService.generateSummaryForTarget>>;
    try {
      summaryResult = await summaryService.generateSummaryForTarget(
        canvasId,
        sourcePodId,
        targetPodId
      );
    } catch (error) {
      logger.error('Workflow', 'Error', 'Failed to generate summary', error);
      const fallback = workflowAutoTriggerService.getLastAssistantMessage(sourcePodId);
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return fallback ? { content: fallback, isSummarized: false } : null;
    }

    if (summaryResult.success) {
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return { content: summaryResult.summary, isSummarized: true };
    }

    logger.error('Workflow', 'Error', `Failed to generate summary: ${summaryResult.error}`);
    const fallback = workflowAutoTriggerService.getLastAssistantMessage(sourcePodId);
    podStore.setStatus(canvasId, sourcePodId, 'idle');
    return fallback ? { content: fallback, isSummarized: false } : null;
  }

  private async processAutoTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection
  ): Promise<void> {
    await workflowAutoTriggerService.processAutoTriggerConnection(
      canvasId,
      sourcePodId,
      connection,
      this.generateSummaryWithFallback.bind(this),
      this.handleMultiInputForConnection.bind(this),
      this.triggerWorkflowInternal.bind(this)
    );
  }

  private emitPendingStatus(canvasId: string, targetPodId: string): void {
    workflowMultiInputService.emitPendingStatus(canvasId, targetPodId);
  }

  private async handleMultiInputForConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    requiredSourcePodIds: string[],
    summary: string,
    triggerMode: 'auto' | 'ai-decide'
  ): Promise<void> {
    await workflowMultiInputService.handleMultiInputForConnection(
      canvasId,
      sourcePodId,
      connection,
      requiredSourcePodIds,
      summary,
      triggerMode,
      this.triggerMergedWorkflow.bind(this)
    );
  }

  private triggerMergedWorkflow(canvasId: string, connection: Connection): void {
    workflowMultiInputService.triggerMergedWorkflow(
      canvasId,
      connection,
      this.triggerWorkflowWithSummary.bind(this)
    );
  }

  /**
   * 處理 AI Decide connections 的批次判斷和觸發
   */
  private async processAiDecideConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<void> {
    // 1. 發送 PENDING 事件
    const connectionIds = connections.map(conn => conn.id);
    workflowEventEmitter.emitAiDecidePending(canvasId, connectionIds, sourcePodId);

    // 2. 更新所有 connections 狀態為 pending
    for (const conn of connections) {
      connectionStore.updateDecideStatus(canvasId, conn.id, 'pending', null);
    }

    // 3. 呼叫 AI Decide Service（只包裹第三方服務呼叫）
    let batchResult: Awaited<ReturnType<typeof aiDecideService.decideConnections>>;
    try {
      batchResult = await aiDecideService.decideConnections(canvasId, sourcePodId, connections);
    } catch (error) {
      logger.error('Workflow', 'Error', '[processAiDecideConnections] AI Decide Service failed', error);

      // 所有 connections 標記為 error
      for (const conn of connections) {
        const errorMessage = getErrorMessage(error);
        connectionStore.updateDecideStatus(canvasId, conn.id, 'error', errorMessage);

        workflowEventEmitter.emitAiDecideError(
          canvasId,
          conn.id,
          sourcePodId,
          conn.targetPodId,
          errorMessage
        );
      }
      return;
    }

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

        if (isMultiInput) {
          const summaryResult = await this.generateSummaryWithFallback(canvasId, sourcePodId, conn.targetPodId);
          if (summaryResult) {
            await this.handleMultiInputForConnection(
              canvasId,
              sourcePodId,
              conn,
              requiredSourcePodIds,
              summaryResult.content,
              'ai-decide'
            );
          }
          continue;
        }

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
          continue;
        }

        this.triggerWorkflowInternal(canvasId, conn.id).catch((error) => {
          logger.error('Workflow', 'Error', `Failed to trigger AI-decided workflow ${conn.id}`, error);
        });
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

    await Promise.all([
      (async (): Promise<void> => {
        for (const connection of autoConnections) {
          await this.processAutoTriggerConnection(canvasId, sourcePodId, connection);
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
    await workflowDirectTriggerService.processDirectConnections(
      canvasId,
      sourcePodId,
      connections,
      this.processDirectTriggerConnection.bind(this)
    );
  }

  private async processDirectTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection
  ): Promise<void> {
    await workflowDirectTriggerService.processDirectTriggerConnection(
      canvasId,
      sourcePodId,
      connection,
      this.generateSummaryWithFallback.bind(this),
      this.handleSingleDirectTrigger.bind(this),
      this.handleMultiDirectTrigger.bind(this)
    );
  }

  private async handleSingleDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    isSummarized: boolean
  ): Promise<void> {
    await workflowDirectTriggerService.handleSingleDirectTrigger(
      canvasId,
      sourcePodId,
      connection,
      summary,
      isSummarized,
      this.triggerWorkflowWithSummary.bind(this)
    );
  }

  private async handleMultiDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    isSummarized: boolean
  ): Promise<void> {
    await workflowDirectTriggerService.handleMultiDirectTrigger(
      canvasId,
      sourcePodId,
      connection,
      summary,
      isSummarized,
      this.handleDirectTimerExpired.bind(this)
    );
  }

  private async handleDirectTimerExpired(canvasId: string, targetPodId: string): Promise<void> {
    await workflowDirectTriggerService.handleDirectTimerExpired(
      canvasId,
      targetPodId,
      this.triggerWorkflowWithSummary.bind(this)
    );
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

    await executeStreamingChat(
      { canvasId, podId: targetPodId, message: messageToSend, connectionId: SystemConnectionIds.WORKFLOW, supportAbort: false },
      {
        onComplete: async () => {
          workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, true, undefined, triggerMode);
          logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);
          await autoClearService.onPodComplete(canvasId, targetPodId);
          workflowQueueService.processNextInQueue(canvasId, targetPodId).catch(error => {
            logger.error('Workflow', 'Error', `處理佇列下一項時發生錯誤: ${error}`);
          });
        },
        onError: async (_canvasId, _podId, error) => {
          const errorMessage = error.message;
          workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, false, errorMessage, triggerMode);
          logger.error('Workflow', 'Error', 'Failed to complete workflow', error);
          workflowQueueService.processNextInQueue(canvasId, targetPodId).catch(error => {
            logger.error('Workflow', 'Error', `處理佇列下一項時發生錯誤: ${error}`);
          });
        },
      }
    );
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
