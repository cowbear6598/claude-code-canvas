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
  emitError,
  validatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';
import { extractRequestId, extractPodId } from '../utils/payloadUtils.js';

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

  if (!requestId) {
    requestId = extractRequestId(payload);
  }

  if (!podId) {
    podId = extractPodId(payload);
  }

  if (podId) {
    podStore.setStatus(podId, 'error');
  }

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

// 整體流程：驗證 payload → 檢查 Pod 狀態 → 設定 busy → 串流處理 Claude 回應
// （包含文字、工具使用、工具結果、完成事件） → 更新 Pod 狀態為 idle
export async function handleChatSend(
  socket: Socket,
  payload: unknown
): Promise<void> {
  let podId: string | undefined;
  let requestId: string | undefined;
  let messageId: string | undefined;

  try {
    validatePayload<PodChatSendPayload>(payload, [
      'requestId',
      'podId',
      'message',
    ]);

    const { requestId: reqId, podId: pid, message } = payload;
    requestId = reqId;
    podId = pid;

    const currentPodId = pid;

    const pod = podStore.getById(currentPodId);
    if (!pod) {
      throw new Error(`Pod not found: ${currentPodId}`);
    }

    if (pod.status === 'busy') {
      throw new Error(`Pod ${currentPodId} is busy processing another request`);
    }

    podStore.setStatus(currentPodId, 'busy');

    messageId = uuidv4();
    const currentMessageId = messageId;

    console.log(`[Chat] Processing message for Pod ${currentPodId}: ${message}`);

    let accumulatedContent = '';

    await claudeQueryService.sendMessage(currentPodId, message, (event) => {
      switch (event.type) {
        case 'text': {
          accumulatedContent += event.content;

          const textPayload: PodChatMessagePayload = {
            podId: currentPodId,
            messageId: currentMessageId,
            content: accumulatedContent,
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
          console.error(`[Chat] Stream error for Pod ${currentPodId}: ${event.error}`);
          break;
        }
      }
    });

    podStore.setStatus(currentPodId, 'idle');
    podStore.updateLastActive(currentPodId);

    console.log(`[Chat] Completed message processing for Pod ${currentPodId}`);
  } catch (error) {
    handleChatError(socket, error, payload, requestId, podId, 'Failed to process message');
  }
}

export async function handleChatHistory(
  socket: Socket,
  payload: unknown
): Promise<void> {
  let requestId: string | undefined;

  try {
    validatePayload<PodChatHistoryPayload>(payload, ['requestId', 'podId']);

    const { requestId: reqId, podId } = payload;
    requestId = reqId;

    console.log(`[Chat] Loading chat history for Pod ${podId}`);

    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    const messages = messageStore.getMessages(podId);

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

    if (!requestId) {
      requestId = extractRequestId(payload);
    }

    const responsePayload: PodChatHistoryResultPayload = {
      requestId: requestId || 'unknown',
      success: false,
      error: errorMessage,
    };

    socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);

    console.error(`[Chat] Failed to load chat history: ${errorMessage}`);
  }
}
