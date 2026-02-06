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
    Connection,
} from '../../types';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {claudeQueryService} from '../claude/queryService.js';
import {socketService} from '../socketService.js';
import {summaryService} from '../summaryService.js';
import {pendingTargetStore} from '../pendingTargetStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {autoClearService} from '../autoClear/index.js';
import {logger} from '../../utils/logger.js';
import {commandService} from '../commandService.js';
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
    const podStatus = podStore.getById(canvasId, connection.targetPodId)?.status;
    if (!podStatus) {
      logger.log('Workflow', 'Error', `Target Pod ${connection.targetPodId} not found, skipping auto-trigger`);
      return;
    }

    if (podStatus === 'chatting' || podStatus === 'summarizing') {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${podStatus}, skipping auto-trigger`);
      return;
    }

    const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
      canvasId,
      connection.targetPodId
    );

    if (!isMultiInput) {
      this.triggerWorkflowInternal(canvasId, connection.id).catch((error) => {
        logger.error('Workflow', 'Error', `Failed to auto-trigger workflow ${connection.id}`, error);
      });
      return;
    }

    await this.handleMultiInputScenario(
      canvasId,
      sourcePodId,
      connection,
      requiredSourcePodIds,
      summaryContentRef
    );
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

    const allSourcesComplete = workflowStateService.recordSourceCompletion(
      connection.targetPodId,
      sourcePodId,
      summaryContentRef.value
    );

    if (!allSourcesComplete) {
      this.emitPendingStatus(canvasId, connection.targetPodId);
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
    const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
      (id) => !completedSourcePodIds.includes(id)
    );

    const pendingPayload: WorkflowPendingPayload = {
      canvasId,
      targetPodId,
      completedSourcePodIds,
      pendingSourcePodIds,
      totalSources: pending.requiredSourcePodIds.length,
      completedCount: pending.completedSources.size,
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

  async checkAndTriggerWorkflows(canvasId: string, sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(canvasId, sourcePodId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);

    if (autoTriggerConnections.length === 0) {
      return;
    }

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    logger.log('Workflow', 'Create', `Found ${autoTriggerConnections.length} auto-trigger connections for Pod "${sourcePod?.name ?? sourcePodId}"`);

    autoClearService.initializeWorkflowTracking(canvasId, sourcePodId);

    const summaryContentRef = { value: null as string | null };

    for (const connection of autoTriggerConnections) {
      await this.processAutoTriggerConnection(canvasId, sourcePodId, connection, summaryContentRef);
    }
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
    isSummarized: boolean
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

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent: summary,
      isSummarized,
    };

    workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, sourcePodId, targetPodId, autoTriggeredPayload);
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

      workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, true);

      logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);

      await autoClearService.onPodComplete(canvasId, targetPodId);
    } catch (error) {
      podStore.setStatus(canvasId, targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      workflowEventEmitter.emitWorkflowComplete(
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        false,
        errorMessage
      );

      logger.error('Workflow', 'Error', 'Failed to complete workflow', error);
      throw error;
    }
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
