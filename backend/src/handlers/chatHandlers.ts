// Chat WebSocket Handlers
// Handles chat operations via WebSocket events

import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatSendPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
} from '../types/index.js';
import { podStore } from '../services/podStore.js';
import { claudeQueryService } from '../services/claude/queryService.js';
import { socketService } from '../services/socketService.js';
import {
  emitSuccess,
  emitError,
  validatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

/**
 * Handle chat send request
 */
export async function handleChatSend(
  socket: Socket,
  payload: unknown
): Promise<void> {
  let podId: string | undefined;
  let requestId: string | undefined;
  let messageId: string | undefined;

  try {
    // Validate payload
    validatePayload<PodChatSendPayload>(payload, [
      'requestId',
      'podId',
      'message',
    ]);

    const { requestId: reqId, podId: pid, message } = payload;
    requestId = reqId;
    podId = pid;

    // Create constants for closure capture
    const currentPodId = pid;
    const currentRequestId = reqId;

    // Check if Pod exists
    const pod = podStore.getById(currentPodId);
    if (!pod) {
      throw new Error(`Pod not found: ${currentPodId}`);
    }

    // Check if Pod is busy
    if (pod.status === 'busy') {
      throw new Error(`Pod ${currentPodId} is busy processing another request`);
    }

    // Set Pod status to busy
    podStore.setStatus(currentPodId, 'busy');

    // Generate message ID
    messageId = uuidv4();
    const currentMessageId = messageId;

    console.log(`[Chat] Processing message for Pod ${currentPodId}: ${message}`);

    // Track accumulated content for the complete event
    let accumulatedContent = '';

    // Process query with streaming callback
    await claudeQueryService.sendMessage(currentPodId, message, (event) => {
      switch (event.type) {
        case 'text': {
          // Accumulate content
          accumulatedContent += event.content;

          // Emit text content to Pod room
          const textPayload: PodChatMessagePayload = {
            podId: currentPodId,
            messageId: currentMessageId,
            content: accumulatedContent, // Send accumulated content
            isPartial: true,
          };
          socketService.emitToPod(
            currentPodId,
            WebSocketResponseEvents.POD_CHAT_MESSAGE,
            textPayload
          );
          break;
        }

        case 'tool_use': {
          // Emit tool use event to Pod room
          const toolUsePayload: PodChatToolUsePayload = {
            podId: currentPodId,
            messageId: currentMessageId,
            toolName: event.toolName,
            input: event.input,
          };
          socketService.emitToPod(
            currentPodId,
            WebSocketResponseEvents.POD_CHAT_TOOL_USE,
            toolUsePayload
          );
          break;
        }

        case 'tool_result': {
          // Emit tool result event to Pod room
          const toolResultPayload: PodChatToolResultPayload = {
            podId: currentPodId,
            messageId: currentMessageId,
            toolName: event.toolName,
            output: event.output,
          };
          socketService.emitToPod(
            currentPodId,
            WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
            toolResultPayload
          );
          break;
        }

        case 'complete': {
          // Emit complete event to Pod room with accumulated content
          const completePayload: PodChatCompletePayload = {
            podId: currentPodId,
            messageId: currentMessageId,
            fullContent: accumulatedContent,
          };
          socketService.emitToPod(
            currentPodId,
            WebSocketResponseEvents.POD_CHAT_COMPLETE,
            completePayload
          );
          break;
        }

        case 'error': {
          // Error will be handled in catch block
          console.error(`[Chat] Stream error for Pod ${currentPodId}: ${event.error}`);
          break;
        }
      }
    });

    // Set Pod status back to idle
    podStore.setStatus(currentPodId, 'idle');
    podStore.updateLastActive(currentPodId);

    console.log(`[Chat] Completed message processing for Pod ${currentPodId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    if (!requestId && typeof payload === 'object' && payload && 'requestId' in payload) {
      requestId = payload.requestId as string;
    }

    if (!podId && typeof payload === 'object' && payload && 'podId' in payload) {
      podId = payload.podId as string;
    }

    // Set Pod status to error if we have a podId
    if (podId) {
      podStore.setStatus(podId, 'error');
    }

    // Emit error response
    emitError(
      socket,
      WebSocketResponseEvents.POD_ERROR,
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[Chat] Failed to process message: ${errorMessage}`);
  }
}
