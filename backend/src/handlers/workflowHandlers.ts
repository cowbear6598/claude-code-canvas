import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type WorkflowTriggerPayload,
  type WorkflowTriggeredPayload,
  type WorkflowCompletePayload,
  type WorkflowErrorPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
} from '../types/index.js';
import { connectionStore } from '../services/connectionStore.js';
import { podStore } from '../services/podStore.js';
import { messageStore } from '../services/messageStore.js';
import { claudeQueryService } from '../services/claude/queryService.js';
import { socketService } from '../services/socketService.js';
import { summaryService } from '../services/summaryService.js';
import { workflowTriggerService } from '../services/workflowTriggerService.js';
import { tryValidatePayload } from '../utils/websocketResponse.js';
import { extractRequestId } from '../utils/payloadUtils.js';

function emitWorkflowError(
  socket: Socket,
  requestId: string,
  connectionId: string,
  error: string,
  code: string
): void {
  const errorPayload: WorkflowErrorPayload = {
    requestId,
    connectionId,
    error,
    code,
  };

  socket.emit(WebSocketResponseEvents.WORKFLOW_ERROR, errorPayload);
  console.error(`[Workflow] Error (${code}): ${error}`);
}

export async function handleWorkflowTrigger(
  socket: Socket,
  payload: unknown
): Promise<void> {
  const validation = tryValidatePayload<WorkflowTriggerPayload>(payload, [
    'requestId',
    'connectionId',
  ]);

  if (!validation.success) {
    const requestId = extractRequestId(payload) || 'unknown';
    const connectionId = (payload as any)?.connectionId || 'unknown';

    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      validation.error || 'Invalid payload',
      'VALIDATION_ERROR'
    );
    return;
  }

  const { requestId, connectionId } = validation.data!;

  const connection = connectionStore.getById(connectionId);
  if (!connection) {
    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      `Connection not found: ${connectionId}`,
      'CONNECTION_NOT_FOUND'
    );
    return;
  }

  const { sourcePodId, targetPodId } = connection;

  const sourcePod = podStore.getById(sourcePodId);
  if (!sourcePod) {
    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      `Source Pod not found: ${sourcePodId}`,
      'SOURCE_POD_NOT_FOUND'
    );
    return;
  }

  const targetPod = podStore.getById(targetPodId);
  if (!targetPod) {
    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      `Target Pod not found: ${targetPodId}`,
      'TARGET_POD_NOT_FOUND'
    );
    return;
  }

  if (targetPod.status === 'busy') {
    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      `Target Pod ${targetPodId} is busy processing another request`,
      'TARGET_POD_BUSY'
    );
    return;
  }

  const messages = messageStore.getMessages(sourcePodId);
  const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

  if (assistantMessages.length === 0) {
    emitWorkflowError(
      socket,
      requestId,
      connectionId,
      `Source Pod ${sourcePodId} has no assistant messages to transfer`,
      'NO_SOURCE_CONTENT'
    );
    return;
  }

  let transferredContent: string;
  let isSummarized: boolean;

  try {
    console.log(
      `[Workflow] Generating summary using source POD ${sourcePodId} session`
    );

    // Generate a unique message ID for the summary request
    const summaryMessageId = uuidv4();
    let summaryContent = '';

    transferredContent = await summaryService.generateSummaryWithSession(
      sourcePodId,
      (event) => {
        // Stream summary generation events to source POD
        switch (event.type) {
          case 'text': {
            summaryContent += event.content;

            const textPayload: PodChatMessagePayload = {
              podId: sourcePodId,
              messageId: summaryMessageId,
              content: summaryContent,
              isPartial: true,
              role: 'assistant',
            };
            socketService.emitToPod(
              sourcePodId,
              WebSocketResponseEvents.POD_CHAT_MESSAGE,
              textPayload
            );
            break;
          }

          case 'complete': {
            const completePayload: PodChatCompletePayload = {
              podId: sourcePodId,
              messageId: summaryMessageId,
              fullContent: summaryContent,
            };
            socketService.emitToPod(
              sourcePodId,
              WebSocketResponseEvents.POD_CHAT_COMPLETE,
              completePayload
            );
            break;
          }

          case 'error': {
            console.error(`[Workflow] Summary generation error: ${event.error}`);
            break;
          }
        }
      }
    );

    isSummarized = true;

    console.log(
      `[Workflow] Summary generated successfully, length: ${transferredContent.length} chars`
    );
  } catch (error) {
    console.error('[Workflow] Failed to generate summary, using last assistant message:', error);
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    transferredContent = lastAssistantMessage.content;
    isSummarized = false;
  }

  const triggeredPayload: WorkflowTriggeredPayload = {
    requestId,
    success: true,
    connectionId,
    sourcePodId,
    targetPodId,
    transferredContent,
    isSummarized,
  };

  socket.emit(WebSocketResponseEvents.WORKFLOW_TRIGGERED, triggeredPayload);
  console.log(
    `[Workflow] Triggered workflow from Pod ${sourcePodId} to Pod ${targetPodId} (summarized: ${isSummarized})`
  );

  podStore.setStatus(targetPodId, 'busy');

  const messageToSend = `以下是從另一個 POD 傳遞過來的內容，請根據這些資訊繼續處理：

---
${transferredContent}
---`;

  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();
  let accumulatedContent = '';

  try {
    // Emit user message event to frontend so it appears in the chat
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

    // Emit complete event for user message
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
          console.error(`[Workflow] Stream error for Pod ${targetPodId}: ${event.error}`);
          break;
        }
      }
    });

    podStore.setStatus(targetPodId, 'idle');
    podStore.updateLastActive(targetPodId);

    const completePayload: WorkflowCompletePayload = {
      requestId,
      connectionId,
      targetPodId,
      success: true,
    };

    socket.emit(WebSocketResponseEvents.WORKFLOW_COMPLETE, completePayload);
    console.log(
      `[Workflow] Completed workflow for connection ${connectionId}, target Pod ${targetPodId}`
    );

    workflowTriggerService.checkAndTriggerWorkflows(targetPodId).catch((error) => {
      console.error(`[Workflow] Failed to check auto-trigger workflows for Pod ${targetPodId}:`, error);
    });
  } catch (error) {
    podStore.setStatus(targetPodId, 'idle');

    const errorMessage = error instanceof Error ? error.message : String(error);

    const completePayload: WorkflowCompletePayload = {
      requestId,
      connectionId,
      targetPodId,
      success: false,
      error: errorMessage,
    };

    socket.emit(WebSocketResponseEvents.WORKFLOW_COMPLETE, completePayload);
    console.error(`[Workflow] Failed to complete workflow: ${errorMessage}`);
  }
}
