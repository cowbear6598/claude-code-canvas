import {v4 as uuidv4} from 'uuid';
import {
    type PodChatCompletePayload,
    type PodChatMessagePayload,
    type PodChatToolResultPayload,
    type PodChatToolUsePayload,
    WebSocketResponseEvents,
    type WorkflowAutoTriggeredPayload,
    type WorkflowPendingPayload,
    type WorkflowSourcesMergedPayload,
} from '../../types/index.js';
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

class WorkflowExecutionService {
  private formatMergedSummaries(canvasId: string, summaries: Map<string, string>): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
      const sourcePod = podStore.getById(canvasId, sourcePodId);
      const podName = sourcePod?.name || sourcePodId;

      formatted.push(`## Source: ${podName}\n${content}\n\n---`);
    }

    let result = formatted.join('\n\n');
    result = result.replace(/\n\n---$/, '');

    return result;
  }

  private buildTransferMessage(content: string): string {
    return `以下是從另一個 POD 傳遞過來的內容,請根據這些資訊繼續處理:

---
${content}
---`;
  }

  private async buildMessageWithCommand(canvasId: string, targetPodId: string, baseMessage: string): Promise<string> {
    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod?.commandId) {
      return baseMessage;
    }

    const commands = await commandService.list();
    const command = commands.find((cmd) => cmd.id === targetPod.commandId);
    if (!command) {
      return baseMessage;
    }

    return `/${command.name} ${baseMessage}`;
  }

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
      logger.log('Workflow', 'Create', `Generating customized summary for source POD ${sourcePodId} to target POD ${targetPodId}`);
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

  async checkAndTriggerWorkflows(canvasId: string, sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(canvasId, sourcePodId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);

    if (autoTriggerConnections.length === 0) {
      return;
    }

    logger.log('Workflow', 'Create', `Found ${autoTriggerConnections.length} auto-trigger connections for Pod ${sourcePodId}`);

    autoClearService.initializeWorkflowTracking(canvasId, sourcePodId);

    let summaryContent: string | null = null;

    for (const connection of autoTriggerConnections) {
      const podStatus = podStore.getById(canvasId, connection.targetPodId)?.status;
      if (!podStatus) {
        logger.log('Workflow', 'Error', `Target Pod ${connection.targetPodId} not found, skipping auto-trigger`);
        continue;
      }

      if (podStatus === 'chatting' || podStatus === 'summarizing') {
        logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${podStatus}, skipping auto-trigger`);
        continue;
      }

      const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
        canvasId,
        connection.targetPodId
      );

      if (!isMultiInput) {
        this.triggerWorkflowInternal(canvasId, connection.id).catch((error) => {
          logger.error('Workflow', 'Error', `Failed to auto-trigger workflow ${connection.id}`, error);
        });
        continue;
      }

      if (!summaryContent) {
        const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, connection.targetPodId);

        if (!result) {
          continue;
        }

        summaryContent = result.content;
      }

      if (!pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
        workflowStateService.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
      }

      const allSourcesComplete = workflowStateService.recordSourceCompletion(
        connection.targetPodId,
        sourcePodId,
        summaryContent
      );

      if (!allSourcesComplete) {
        const pending = pendingTargetStore.getPendingTarget(connection.targetPodId);
        if (!pending) {
          continue;
        }

        const completedSourcePodIds = Array.from(pending.completedSources.keys());
        const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
          (id) => !completedSourcePodIds.includes(id)
        );

        const pendingPayload: WorkflowPendingPayload = {
          targetPodId: connection.targetPodId,
          completedSourcePodIds,
          pendingSourcePodIds,
          totalSources: pending.requiredSourcePodIds.length,
          completedCount: pending.completedSources.size,
        };

        socketService.emitToPod(
          connection.targetPodId,
          WebSocketResponseEvents.WORKFLOW_PENDING,
          pendingPayload
        );

        logger.log('Workflow', 'Update', `Target ${connection.targetPodId} waiting: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources complete`);
        continue;
      }

      logger.log('Workflow', 'Complete', `All sources complete for target ${connection.targetPodId}`);

      const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
      if (!completedSummaries) {
        logger.error('Workflow', 'Error', 'Failed to get completed summaries');
        continue;
      }

      const mergedContent = this.formatMergedSummaries(canvasId, completedSummaries);
      const mergedPreview = mergedContent.substring(0, 200);

      const sourcePodIds = Array.from(completedSummaries.keys());
      const mergedPayload: WorkflowSourcesMergedPayload = {
        targetPodId: connection.targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedPreview,
      };

      socketService.emitToPod(
        connection.targetPodId,
        WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
        mergedPayload
      );

      for (const sourceId of sourcePodIds) {
        socketService.emitToPod(
          sourceId,
          WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
          mergedPayload
        );
      }

      this.triggerWorkflowWithSummary(canvasId, connection.id, mergedContent, true).catch((error) => {
        logger.error('Workflow', 'Error', `Failed to trigger merged workflow ${connection.id}`, error);
      });

      workflowStateService.clearPendingTarget(connection.targetPodId);
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

    logger.log('Workflow', 'Create', `Auto-triggering workflow from Pod ${sourcePodId} to Pod ${targetPodId} (summarized: ${isSummarized})`);

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    workflowEventEmitter.emitWorkflowAutoTriggered(sourcePodId, targetPodId, autoTriggeredPayload);
    workflowEventEmitter.emitWorkflowTriggered(
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

    workflowEventEmitter.emitWorkflowAutoTriggered(sourcePodId, targetPodId, autoTriggeredPayload);
    workflowEventEmitter.emitWorkflowTriggered(
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

    const baseMessage = this.buildTransferMessage(content);
    const messageToSend = await this.buildMessageWithCommand(canvasId, targetPodId, baseMessage);

    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();
    let accumulatedContent = '';

    try {
      const userMessagePayload: PodChatMessagePayload = {
        podId: targetPodId,
        messageId: userMessageId,
        content: messageToSend,
        isPartial: false,
        role: 'user',
      };
      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
        userMessagePayload
      );

      const userCompletePayload: PodChatCompletePayload = {
        podId: targetPodId,
        messageId: userMessageId,
        fullContent: messageToSend,
      };
      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        userCompletePayload
      );

      await messageStore.addMessage(canvasId, targetPodId, 'user', messageToSend);

      await claudeQueryService.sendMessage(targetPodId, messageToSend, (event) => {
        switch (event.type) {
          case 'text': {
            accumulatedContent += event.content;

            const textPayload: PodChatMessagePayload = {
              podId: targetPodId,
              messageId: assistantMessageId,
              content: accumulatedContent,
              isPartial: true,
              role: 'assistant',
            };
            socketService.emitToPod(
              targetPodId,
              WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
              textPayload
            );
            break;
          }

          case 'tool_use': {
            const toolUsePayload: PodChatToolUsePayload = {
              podId: targetPodId,
              messageId: assistantMessageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
            };
            socketService.emitToPod(
              targetPodId,
              WebSocketResponseEvents.POD_CHAT_TOOL_USE,
              toolUsePayload
            );
            break;
          }

          case 'tool_result': {
            const toolResultPayload: PodChatToolResultPayload = {
              podId: targetPodId,
              messageId: assistantMessageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              output: event.output,
            };
            socketService.emitToPod(
              targetPodId,
              WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
              toolResultPayload
            );
            break;
          }

          case 'complete': {
            const completePayload: PodChatCompletePayload = {
              podId: targetPodId,
              messageId: assistantMessageId,
              fullContent: accumulatedContent,
            };
            socketService.emitToPod(
              targetPodId,
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
      });

      if (accumulatedContent) {
        await messageStore.addMessage(canvasId, targetPodId, 'assistant', accumulatedContent);
      }

      podStore.setStatus(canvasId, targetPodId, 'idle');
      podStore.updateLastActive(canvasId, targetPodId);

      workflowEventEmitter.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, true);

      logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod ${targetPodId}`);

      await autoClearService.onPodComplete(canvasId, targetPodId);
    } catch (error) {
      podStore.setStatus(canvasId, targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      workflowEventEmitter.emitWorkflowComplete(
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
