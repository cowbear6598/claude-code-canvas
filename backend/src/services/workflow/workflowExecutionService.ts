import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type WorkflowAutoTriggeredPayload,
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
} from '../../types/index.js';
import { connectionStore } from '../connectionStore.js';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';
import { claudeQueryService } from '../claude/queryService.js';
import { socketService } from '../socketService.js';
import { summaryService } from '../summaryService.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
import { workflowStateService } from './workflowStateService.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import { autoClearService } from '../autoClear/index.js';

class WorkflowExecutionService {
  private formatMergedSummaries(summaries: Map<string, string>): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
      const sourcePod = podStore.getById(sourcePodId);
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

  private getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      console.error('[WorkflowContentFormatter] No assistant messages available for fallback');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }

  async checkAndTriggerWorkflows(sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(sourcePodId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);

    if (autoTriggerConnections.length === 0) {
      return;
    }

    console.log(
      `[WorkflowExecution] Found ${autoTriggerConnections.length} auto-trigger connections for Pod ${sourcePodId}`
    );

    // Initialize auto-clear tracking if enabled
    autoClearService.initializeWorkflowTracking(sourcePodId);

    let summary: string | null = null;

    for (const connection of autoTriggerConnections) {
      const podStatus = podStore.getById(connection.targetPodId)?.status;
      if (!podStatus) {
        console.warn(
          `[WorkflowExecution] Target Pod ${connection.targetPodId} not found, skipping auto-trigger`
        );
        continue;
      }

      if (podStatus === 'chatting' || podStatus === 'summarizing') {
        console.warn(
          `[WorkflowExecution] Target Pod ${connection.targetPodId} is ${podStatus}, skipping auto-trigger`
        );
        continue;
      }

      const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
        connection.targetPodId
      );

      if (!isMultiInput) {
        this.triggerWorkflowInternal(connection.id).catch((error) => {
          console.error(
            `[WorkflowExecution] Failed to auto-trigger workflow ${connection.id}:`,
            error
          );
        });
        continue;
      }

      if (!summary) {
        try {
          podStore.setStatus(sourcePodId, 'summarizing');
          console.log(
            `[WorkflowExecution] Generating customized summary for source POD ${sourcePodId} to target POD ${connection.targetPodId}`
          );
          const summaryResult = await summaryService.generateSummaryForTarget(
            sourcePodId,
            connection.targetPodId
          );

          if (summaryResult.success) {
            summary = summaryResult.summary;
          } else {
            console.error(`[WorkflowExecution] Failed to generate summary: ${summaryResult.error}`);
            summary = this.getLastAssistantMessage(sourcePodId);

            if (!summary) {
              podStore.setStatus(sourcePodId, 'idle');
              continue;
            }
          }
          podStore.setStatus(sourcePodId, 'idle');
        } catch (error) {
          console.error('[WorkflowExecution] Failed to generate summary:', error);
          summary = this.getLastAssistantMessage(sourcePodId);

          if (!summary) {
            podStore.setStatus(sourcePodId, 'idle');
            continue;
          }
          podStore.setStatus(sourcePodId, 'idle');
        }
      }

      if (!pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
        workflowStateService.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
      }

      const allSourcesComplete = workflowStateService.recordSourceCompletion(
        connection.targetPodId,
        sourcePodId,
        summary
      );

      if (allSourcesComplete) {
        console.log(`[WorkflowExecution] All sources complete for target ${connection.targetPodId}`);

        const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
        if (!completedSummaries) {
          console.error('[WorkflowExecution] Failed to get completed summaries');
          continue;
        }

        const mergedContent = this.formatMergedSummaries(completedSummaries);
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

        this.triggerWorkflowWithSummary(connection.id, mergedContent, true).catch((error) => {
          console.error(
            `[WorkflowExecution] Failed to trigger merged workflow ${connection.id}:`,
            error
          );
        });

        workflowStateService.clearPendingTarget(connection.targetPodId);
      } else {
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

        console.log(
          `[WorkflowExecution] Target ${connection.targetPodId} waiting: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources complete`
        );
      }
    }
  }

  async triggerWorkflowInternal(connectionId: string): Promise<void> {
    const connection = connectionStore.getById(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const sourcePod = podStore.getById(sourcePodId);
    if (!sourcePod) {
      throw new Error(`Pod not found: ${sourcePodId}`);
    }

    const targetPod = podStore.getById(targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
    if (assistantMessages.length === 0) {
      throw new Error(`Source Pod ${sourcePodId} has no assistant messages to transfer`);
    }

    let transferredContent: string;
    let isSummarized: boolean;

    try {
      podStore.setStatus(sourcePodId, 'summarizing');
      console.log(
        `[WorkflowExecution] Generating customized summary from source POD ${sourcePodId} to target POD ${targetPodId}`
      );

      const summaryResult = await summaryService.generateSummaryForTarget(sourcePodId, targetPodId);

      if (summaryResult.success) {
        transferredContent = summaryResult.summary;
        isSummarized = true;
        console.log(
          `[WorkflowExecution] Summary generated successfully, length: ${transferredContent.length} chars`
        );
      } else {
        console.error(
          `[WorkflowExecution] Failed to generate summary: ${summaryResult.error}, using last assistant message`
        );
        const fallbackContent = this.getLastAssistantMessage(sourcePodId);
        if (!fallbackContent) {
          throw new Error('無可用的備用內容');
        }
        transferredContent = fallbackContent;
        isSummarized = false;
      }
      podStore.setStatus(sourcePodId, 'idle');
    } catch (error) {
      podStore.setStatus(sourcePodId, 'idle');
      console.error(
        '[WorkflowExecution] Failed to generate summary, using last assistant message:',
        error
      );
      const fallbackContent = this.getLastAssistantMessage(sourcePodId);
      if (!fallbackContent) {
        throw new Error('無可用的備用內容');
      }
      transferredContent = fallbackContent;
      isSummarized = false;
    }

    console.log(
      `[WorkflowExecution] Auto-triggering workflow from Pod ${sourcePodId} to Pod ${targetPodId} (summarized: ${isSummarized})`
    );

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

    await this.executeClaudeQuery(connectionId, sourcePodId, targetPodId, transferredContent);

    this.checkAndTriggerWorkflows(targetPodId).catch((error) => {
      console.error(
        `[WorkflowExecution] Failed to check auto-trigger workflows for Pod ${targetPodId}:`,
        error
      );
    });
  }

  async triggerWorkflowWithSummary(
    connectionId: string,
    summary: string,
    isSummarized: boolean
  ): Promise<void> {
    const connection = connectionStore.getById(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const targetPod = podStore.getById(targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    console.log(
      `[WorkflowExecution] Triggering workflow with pre-generated summary from Pod ${sourcePodId} to Pod ${targetPodId}`
    );

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

    await this.executeClaudeQuery(connectionId, sourcePodId, targetPodId, summary);

    this.checkAndTriggerWorkflows(targetPodId).catch((error) => {
      console.error(
        `[WorkflowExecution] Failed to check auto-trigger workflows for Pod ${targetPodId}:`,
        error
      );
    });
  }

  private async executeClaudeQuery(
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    content: string
  ): Promise<void> {
    podStore.setStatus(targetPodId, 'chatting');

    const messageToSend = this.buildTransferMessage(content);

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
        WebSocketResponseEvents.POD_CHAT_MESSAGE,
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
              WebSocketResponseEvents.POD_CHAT_MESSAGE,
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
            console.error(`[WorkflowExecution] Stream error for Pod ${targetPodId}: ${event.error}`);
            break;
          }
        }
      });

      if (accumulatedContent) {
        await messageStore.addMessage(targetPodId, 'assistant', accumulatedContent);
      }

      podStore.setStatus(targetPodId, 'idle');
      podStore.updateLastActive(targetPodId);

      workflowEventEmitter.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, true);

      console.log(
        `[WorkflowExecution] Completed workflow for connection ${connectionId}, target Pod ${targetPodId}`
      );

      await autoClearService.onPodComplete(targetPodId);
    } catch (error) {
      podStore.setStatus(targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      workflowEventEmitter.emitWorkflowComplete(
        connectionId,
        sourcePodId,
        targetPodId,
        false,
        errorMessage
      );

      console.error(`[WorkflowExecution] Failed to complete workflow:`, error);
      throw error;
    }
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
