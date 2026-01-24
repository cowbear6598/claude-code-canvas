import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type WorkflowAutoTriggeredPayload,
} from '../types/index.js';
import { connectionStore } from './connectionStore.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { claudeQueryService } from './claude/queryService.js';
import { socketService } from './socketService.js';
import { summaryService } from './summaryService.js';

class WorkflowTriggerService {
  async checkAndTriggerWorkflows(sourcePodId: string): Promise<void> {
    const connections = connectionStore.findBySourcePodId(sourcePodId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);

    if (autoTriggerConnections.length === 0) {
      return;
    }

    console.log(
      `[WorkflowTrigger] Found ${autoTriggerConnections.length} auto-trigger connections for Pod ${sourcePodId}`
    );

    for (const connection of autoTriggerConnections) {
      const targetPod = podStore.getById(connection.targetPodId);
      if (!targetPod) {
        console.warn(
          `[WorkflowTrigger] Target Pod ${connection.targetPodId} not found, skipping auto-trigger`
        );
        continue;
      }

      if (targetPod.status === 'busy') {
        console.warn(
          `[WorkflowTrigger] Target Pod ${connection.targetPodId} is busy, skipping auto-trigger`
        );
        continue;
      }

      this.triggerWorkflowInternal(connection.id).catch((error) => {
        console.error(
          `[WorkflowTrigger] Failed to auto-trigger workflow ${connection.id}:`,
          error
        );
      });
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
      console.log(
        `[WorkflowTrigger] Generating summary using source POD ${sourcePodId} session`
      );

      transferredContent = await summaryService.generateSummaryWithSession(
        sourcePodId
      );
      isSummarized = true;

      console.log(
        `[WorkflowTrigger] Summary generated successfully, length: ${transferredContent.length} chars`
      );
    } catch (error) {
      console.error(
        '[WorkflowTrigger] Failed to generate summary, using last assistant message:',
        error
      );
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      transferredContent = lastAssistantMessage.content;
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
    const triggeredPayload = {
      requestId: uuidv4(),
      success: true,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };
    socketService.emitToPod(
      sourcePodId,
      WebSocketResponseEvents.WORKFLOW_TRIGGERED,
      triggeredPayload
    );
    socketService.emitToPod(
      targetPodId,
      WebSocketResponseEvents.WORKFLOW_TRIGGERED,
      triggeredPayload
    );

    podStore.setStatus(targetPodId, 'busy');

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

      // Emit workflow complete event to notify frontend
      const completePayload = {
        requestId: uuidv4(),
        connectionId,
        targetPodId,
        success: true,
      };
      socketService.emitToPod(
        sourcePodId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        completePayload
      );
      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        completePayload
      );

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

      // Emit workflow error event to notify frontend
      const errorPayload = {
        requestId: uuidv4(),
        connectionId,
        targetPodId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      socketService.emitToPod(
        sourcePodId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        errorPayload
      );
      socketService.emitToPod(
        targetPodId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        errorPayload
      );

      console.error(`[WorkflowTrigger] Failed to complete auto-triggered workflow:`, error);
      throw error;
    }
  }
}

export const workflowTriggerService = new WorkflowTriggerService();
