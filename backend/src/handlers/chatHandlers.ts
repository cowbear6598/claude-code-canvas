// Chat WebSocket Handlers
// Handles chat operations via WebSocket events

import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatSendPayload,
  type PodChatHistoryPayload,
  type PodChatHistoryResultPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
} from '../types/index.js';
import { podStore } from '../services/podStore.js';
import { messageStore } from '../services/messageStore.js';
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
 * Handle chat error with consistent error processing
 */
function handleChatError(
  socket: Socket,
  error: unknown,
  payload: unknown,
  requestId: string | undefined,
  podId: string | undefined,
  logMessage: string
): void {
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Extract requestId and podId from payload if not already set
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

  console.error(`[Chat] ${logMessage}: ${errorMessage}`);
}

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
    handleChatError(socket, error, payload, requestId, podId, 'Failed to process message');
  }
}

/**
 * Handle chat history request
 */
export async function handleChatHistory(
  socket: Socket,
  payload: unknown
): Promise<void> {
  let requestId: string | undefined;

  try {
    // Validate payload
    validatePayload<PodChatHistoryPayload>(payload, ['requestId', 'podId']);

    const { requestId: reqId, podId } = payload;
    requestId = reqId;

    console.log(`[Chat] Loading chat history for Pod ${podId}`);

    // Check if Pod exists
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    // Get messages from message store
    const messages = messageStore.getMessages(podId);

    // Emit success response with messages
    const responsePayload: PodChatHistoryResultPayload = {
      requestId,
      success: true,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    };

    socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);

    console.log(`[Chat] Sent ${messages.length} messages for Pod ${podId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    // Extract requestId from payload if not already set
    if (!requestId && typeof payload === 'object' && payload && 'requestId' in payload) {
      requestId = payload.requestId as string;
    }

    // Emit error response
    const responsePayload: PodChatHistoryResultPayload = {
      requestId: requestId || 'unknown',
      success: false,
      error: errorMessage,
    };

    socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);

    console.error(`[Chat] Failed to load chat history: ${errorMessage}`);
  }
}
