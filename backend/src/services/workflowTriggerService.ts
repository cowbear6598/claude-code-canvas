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
} from '../types/index.js';
import { connectionStore } from './connectionStore.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { claudeQueryService } from './claude/queryService.js';
import { socketService } from './socketService.js';
import { summaryService } from './summaryService.js';
import { pendingTargetStore } from './pendingTargetStore.js';

class WorkflowTriggerService {
  /**
   * Emit workflow completion event to connected PODs
   */
  private emitWorkflowComplete(
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    success: boolean,
    error?: string
  ): void {
    const payload = {
      requestId: uuidv4(),
      connectionId,
      targetPodId,
      success,
      ...(error && { error }),
    };
    socketService.emitToPod(sourcePodId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
  }

  /**
   * Emit workflow triggered event to connected PODs
   */
  private emitWorkflowTriggered(
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    transferredContent: string,
    isSummarized: boolean
  ): void {
    const payload = {
      requestId: uuidv4(),
      success: true,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };
    socketService.emitToPod(sourcePodId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
  }

  /**
   * Fallback to last assistant message when summary generation fails
   */
  private getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      console.error('[WorkflowTrigger] No assistant messages available for fallback');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }

  /**
   * Check if target POD has multiple auto-trigger connections (Multi-Input scenario)
   */
  private checkMultiInputScenario(targetPodId: string): { isMultiInput: boolean; requiredSourcePodIds: string[] } {
    const incomingConnections = connectionStore.findByTargetPodId(targetPodId);
    const autoTriggerConnections = incomingConnections.filter(conn => conn.autoTrigger);
    const requiredSourcePodIds = autoTriggerConnections.map(conn => conn.sourcePodId);

    return {
      isMultiInput: autoTriggerConnections.length > 1,
      requiredSourcePodIds,
    };
  }

  /**
   * Format merged summaries from multiple sources with POD names
   */
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

  async checkAndTriggerWorkflows(sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(sourcePodId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);

    if (autoTriggerConnections.length === 0) {
      return;
    }

    console.log(
      `[WorkflowTrigger] Found ${autoTriggerConnections.length} auto-trigger connections for Pod ${sourcePodId}`
    );

    let summary: string | null = null;
    let isSummarized = false;

    for (const connection of autoTriggerConnections) {
      const targetPod = podStore.getById(connection.targetPodId);
      if (!targetPod) {
        console.warn(
          `[WorkflowTrigger] Target Pod ${connection.targetPodId} not found, skipping auto-trigger`
        );
        continue;
      }

      if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
        console.warn(
          `[WorkflowTrigger] Target Pod ${connection.targetPodId} is ${targetPod.status}, skipping auto-trigger`
        );
        continue;
      }

      const { isMultiInput, requiredSourcePodIds } = this.checkMultiInputScenario(connection.targetPodId);

      if (!isMultiInput) {
        this.triggerWorkflowInternal(connection.id).catch((error) => {
          console.error(
            `[WorkflowTrigger] Failed to auto-trigger workflow ${connection.id}:`,
            error
          );
        });
        continue;
      }

      if (!summary) {
        try {
          podStore.setStatus(sourcePodId, 'summarizing');
          console.log(`[WorkflowTrigger] Generating customized summary for source POD ${sourcePodId} to target POD ${connection.targetPodId}`);
          const summaryResult = await summaryService.generateSummaryForTarget(sourcePodId, connection.targetPodId);

          if (summaryResult.success) {
            summary = summaryResult.summary;
            isSummarized = true;
          } else {
            console.error(`[WorkflowTrigger] Failed to generate summary: ${summaryResult.error}`);
            summary = this.getLastAssistantMessage(sourcePodId);
            isSummarized = false;

            if (!summary) {
              podStore.setStatus(sourcePodId, 'idle');
              continue;
            }
          }
          podStore.setStatus(sourcePodId, 'idle');
        } catch (error) {
          console.error('[WorkflowTrigger] Failed to generate summary:', error);
          summary = this.getLastAssistantMessage(sourcePodId);
          isSummarized = false;

          if (!summary) {
            podStore.setStatus(sourcePodId, 'idle');
            continue;
          }
          podStore.setStatus(sourcePodId, 'idle');
        }
      }

      if (!pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
        pendingTargetStore.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
        console.log(
          `[WorkflowTrigger] Initialized pending target ${connection.targetPodId}, waiting for ${requiredSourcePodIds.length} sources`
        );
      }

      const allSourcesComplete = pendingTargetStore.recordSourceCompletion(
        connection.targetPodId,
        sourcePodId,
        summary
      );

      if (allSourcesComplete) {
        console.log(`[WorkflowTrigger] All sources complete for target ${connection.targetPodId}`);

        const completedSummaries = pendingTargetStore.getCompletedSummaries(connection.targetPodId);
        if (!completedSummaries) {
          console.error('[WorkflowTrigger] Failed to get completed summaries');
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
            `[WorkflowTrigger] Failed to trigger merged workflow ${connection.id}:`,
            error
          );
        });

        pendingTargetStore.clearPendingTarget(connection.targetPodId);
      } else {
        const pending = pendingTargetStore.getPendingTarget(connection.targetPodId);
        if (!pending) {
          continue;
        }

        const completedSourcePodIds = Array.from(pending.completedSources.keys());
        const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
          id => !completedSourcePodIds.includes(id)
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
          `[WorkflowTrigger] Target ${connection.targetPodId} waiting: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources complete`
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
      throw new Error(`Source Pod not found: ${sourcePodId}`);
    }

    const targetPod = podStore.getById(targetPodId);
    if (!targetPod) {
      throw new Error(`Target Pod not found: ${targetPodId}`);
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
        `[WorkflowTrigger] Generating customized summary from source POD ${sourcePodId} to target POD ${targetPodId}`
      );

      const summaryResult = await summaryService.generateSummaryForTarget(
        sourcePodId,
        targetPodId
      );

      if (summaryResult.success) {
        transferredContent = summaryResult.summary;
        isSummarized = true;
        console.log(
          `[WorkflowTrigger] Summary generated successfully, length: ${transferredContent.length} chars`
        );
      } else {
        console.error(
          `[WorkflowTrigger] Failed to generate summary: ${summaryResult.error}, using last assistant message`
        );
        transferredContent = assistantMessages[assistantMessages.length - 1].content;
        isSummarized = false;
      }
      podStore.setStatus(sourcePodId, 'idle');
    } catch (error) {
      podStore.setStatus(sourcePodId, 'idle');
      console.error(
        '[WorkflowTrigger] Failed to generate summary, using last assistant message:',
        error
      );
      transferredContent = assistantMessages[assistantMessages.length - 1].content;
      isSummarized = false;
    }

    console.log(
      `[WorkflowTrigger] Auto-triggering workflow from Pod ${sourcePodId} to Pod ${targetPodId} (summarized: ${isSummarized})`
    );

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    socketService.emitToPod(
      sourcePodId,
      WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
      autoTriggeredPayload
    );
    socketService.emitToPod(
      targetPodId,
      WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
      autoTriggeredPayload
    );

    // Emit WorkflowTriggered event to update status to 'processing'
    this.emitWorkflowTriggered(connectionId, sourcePodId, targetPodId, transferredContent, isSummarized);

    podStore.setStatus(targetPodId, 'chatting');

    const messageToSend = `以下是從另一個 POD 傳遞過來的內容,請根據這些資訊繼續處理:

---
${transferredContent}
---`;

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
            console.error(
              `[WorkflowTrigger] Stream error for Pod ${targetPodId}: ${event.error}`
            );
            break;
          }
        }
      });

      podStore.setStatus(targetPodId, 'idle');
      podStore.updateLastActive(targetPodId);

      this.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, true);

      console.log(
        `[WorkflowTrigger] Completed auto-triggered workflow for connection ${connectionId}, target Pod ${targetPodId}`
      );

      // Check if there are more auto-trigger workflows from this target POD
      this.checkAndTriggerWorkflows(targetPodId).catch((error) => {
        console.error(
          `[WorkflowTrigger] Failed to check auto-trigger workflows for Pod ${targetPodId}:`,
          error
        );
      });
    } catch (error) {
      podStore.setStatus(targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, false, errorMessage);

      console.error(`[WorkflowTrigger] Failed to complete auto-triggered workflow:`, error);
      throw error;
    }
  }

  /**
   * Trigger workflow with pre-generated summary (for Multi-Input and Multi-Output optimization)
   */
  async triggerWorkflowWithSummary(connectionId: string, summary: string, isSummarized: boolean): Promise<void> {
    const connection = connectionStore.getById(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const targetPod = podStore.getById(targetPodId);
    if (!targetPod) {
      throw new Error(`Target Pod not found: ${targetPodId}`);
    }

    console.log(
      `[WorkflowTrigger] Triggering workflow with pre-generated summary from Pod ${sourcePodId} to Pod ${targetPodId}`
    );

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent: summary,
      isSummarized,
    };

    socketService.emitToPod(
      sourcePodId,
      WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
      autoTriggeredPayload
    );
    socketService.emitToPod(
      targetPodId,
      WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
      autoTriggeredPayload
    );

    this.emitWorkflowTriggered(connectionId, sourcePodId, targetPodId, summary, isSummarized);

    podStore.setStatus(targetPodId, 'chatting');

    const messageToSend = `以下是從另一個 POD 傳遞過來的內容,請根據這些資訊繼續處理:

---
${summary}
---`;

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
            console.error(
              `[WorkflowTrigger] Stream error for Pod ${targetPodId}: ${event.error}`
            );
            break;
          }
        }
      });

      podStore.setStatus(targetPodId, 'idle');
      podStore.updateLastActive(targetPodId);

      this.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, true);

      console.log(
        `[WorkflowTrigger] Completed workflow with summary for connection ${connectionId}, target Pod ${targetPodId}`
      );

      this.checkAndTriggerWorkflows(targetPodId).catch((error) => {
        console.error(
          `[WorkflowTrigger] Failed to check auto-trigger workflows for Pod ${targetPodId}:`,
          error
        );
      });
    } catch (error) {
      podStore.setStatus(targetPodId, 'idle');

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitWorkflowComplete(connectionId, sourcePodId, targetPodId, false, errorMessage);

      console.error(`[WorkflowTrigger] Failed to complete workflow with summary:`, error);
      throw error;
    }
  }

  /**
   * Handle source POD deletion - remove from pending targets
   */
  handleSourceDeletion(sourcePodId: string): void {
    const affectedTargetIds = pendingTargetStore.removeSourceFromAllPending(sourcePodId);

    for (const targetPodId of affectedTargetIds) {
      const pending = pendingTargetStore.getPendingTarget(targetPodId);
      if (!pending) {
        continue;
      }

      if (pending.requiredSourcePodIds.length === 0) {
        pendingTargetStore.clearPendingTarget(targetPodId);
        console.log(`[WorkflowTrigger] Cleared pending target ${targetPodId} - no sources remaining`);
        continue;
      }

      const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

      if (allComplete) {
        console.log(`[WorkflowTrigger] Source deleted, but remaining sources complete for ${targetPodId}`);

        const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
        if (!completedSummaries) {
          continue;
        }

        const mergedContent = this.formatMergedSummaries(completedSummaries);
        const sourcePodIds = Array.from(completedSummaries.keys());

        const mergedPayload: WorkflowSourcesMergedPayload = {
          targetPodId,
          sourcePodIds,
          mergedContentPreview: mergedContent.substring(0, 200),
        };

        socketService.emitToPod(
          targetPodId,
          WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
          mergedPayload
        );

        const connections = connectionStore.findByTargetPodId(targetPodId);
        const autoTriggerConnection = connections.find(conn => conn.autoTrigger);

        if (autoTriggerConnection) {
          this.triggerWorkflowWithSummary(autoTriggerConnection.id, mergedContent, true).catch((error) => {
            console.error(`[WorkflowTrigger] Failed to trigger merged workflow:`, error);
          });
        }

        pendingTargetStore.clearPendingTarget(targetPodId);
      } else {
        const completedSourcePodIds = Array.from(pending.completedSources.keys());
        const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
          id => !completedSourcePodIds.includes(id)
        );

        const pendingPayload: WorkflowPendingPayload = {
          targetPodId,
          completedSourcePodIds,
          pendingSourcePodIds,
          totalSources: pending.requiredSourcePodIds.length,
          completedCount: pending.completedSources.size,
        };

        socketService.emitToPod(
          targetPodId,
          WebSocketResponseEvents.WORKFLOW_PENDING,
          pendingPayload
        );

        console.log(
          `[WorkflowTrigger] Updated pending target ${targetPodId}: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources`
        );
      }
    }
  }

  /**
   * Handle connection deletion - remove from pending targets
   */
  handleConnectionDeletion(connectionId: string): void {
    const connection = connectionStore.getById(connectionId);
    if (!connection || !connection.autoTrigger) {
      return;
    }

    const { sourcePodId, targetPodId } = connection;

    if (!pendingTargetStore.hasPendingTarget(targetPodId)) {
      return;
    }

    pendingTargetStore.removeSourceFromPending(targetPodId, sourcePodId);

    const pending = pendingTargetStore.getPendingTarget(targetPodId);
    if (!pending) {
      return;
    }

    if (pending.requiredSourcePodIds.length === 0) {
      pendingTargetStore.clearPendingTarget(targetPodId);
      console.log(`[WorkflowTrigger] Cleared pending target ${targetPodId} - connection deleted`);
      return;
    }

    const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

    if (allComplete) {
      console.log(`[WorkflowTrigger] Connection deleted, but remaining sources complete for ${targetPodId}`);

      const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
      if (!completedSummaries) {
        return;
      }

      const mergedContent = this.formatMergedSummaries(completedSummaries);
      const sourcePodIds = Array.from(completedSummaries.keys());

      const mergedPayload: WorkflowSourcesMergedPayload = {
        targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedContent.substring(0, 200),
      };

      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
        mergedPayload
      );

      const connections = connectionStore.findByTargetPodId(targetPodId);
      const autoTriggerConnection = connections.find(conn => conn.autoTrigger);

      if (autoTriggerConnection) {
        this.triggerWorkflowWithSummary(autoTriggerConnection.id, mergedContent, true).catch((error) => {
          console.error(`[WorkflowTrigger] Failed to trigger merged workflow:`, error);
        });
      }

      pendingTargetStore.clearPendingTarget(targetPodId);
    } else {
      const completedSourcePodIds = Array.from(pending.completedSources.keys());
      const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
        id => !completedSourcePodIds.includes(id)
      );

      const pendingPayload: WorkflowPendingPayload = {
        targetPodId,
        completedSourcePodIds,
        pendingSourcePodIds,
        totalSources: pending.requiredSourcePodIds.length,
        completedCount: pending.completedSources.size,
      };

      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.WORKFLOW_PENDING,
        pendingPayload
      );

      console.log(
        `[WorkflowTrigger] Updated pending target ${targetPodId}: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources`
      );
    }
  }
}

export const workflowTriggerService = new WorkflowTriggerService();
