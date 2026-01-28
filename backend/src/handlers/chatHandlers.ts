import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatHistoryResultPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
} from '../types/index.js';
import type { ChatSendPayload, ChatHistoryPayload } from '../schemas/index.js';
import { podStore } from '../services/podStore.js';
import { messageStore } from '../services/messageStore.js';
import { claudeQueryService } from '../services/claude/queryService.js';
import { socketService } from '../services/socketService.js';
import { workflowService } from '../services/workflow/index.js';
import { autoClearService } from '../services/autoClear/index.js';
import { emitError } from '../utils/websocketResponse.js';

// 整體流程：驗證 payload → 檢查 Pod 狀態 → 設定 chatting → 串流處理 Claude 回應
// （包含文字、工具使用、工具結果、完成事件） → 更新 Pod 狀態為 idle
export async function handleChatSend(
  socket: Socket,
  payload: ChatSendPayload,
  requestId: string
): Promise<void> {
  const { podId, message } = payload;

  // Check if Pod exists
  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_ERROR,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    console.error(`[Chat] Failed to process message: Pod not found: ${podId}`);
    return;
  }

  // Check if Pod is busy
  if (pod.status === 'chatting' || pod.status === 'summarizing') {
    emitError(
      socket,
      WebSocketResponseEvents.POD_ERROR,
      `Pod ${podId} is currently ${pod.status}, please wait`,
      requestId,
      podId,
      'POD_BUSY'
    );

    console.error(`[Chat] Pod ${podId} is currently ${pod.status}, please wait`);
    return;
  }

  // Set Pod to chatting
  podStore.setStatus(podId, 'chatting');

  const messageId = uuidv4();

  console.log(`[Chat] Processing message for Pod ${podId}: ${message}`);

  let accumulatedContent = '';

  await claudeQueryService.sendMessage(podId, message, (event) => {
    switch (event.type) {
      case 'text': {
        accumulatedContent += event.content;

        const textPayload: PodChatMessagePayload = {
          podId,
          messageId,
          content: accumulatedContent,
          isPartial: true,
          role: 'assistant',
        };
        socketService.emitToPod(
          podId,
          WebSocketResponseEvents.POD_CHAT_MESSAGE,
          textPayload
        );
        break;
      }

      case 'tool_use': {
        const toolUsePayload: PodChatToolUsePayload = {
          podId,
          messageId,
          toolName: event.toolName,
          input: event.input,
        };
        socketService.emitToPod(
          podId,
          WebSocketResponseEvents.POD_CHAT_TOOL_USE,
          toolUsePayload
        );
        break;
      }

      case 'tool_result': {
        const toolResultPayload: PodChatToolResultPayload = {
          podId,
          messageId,
          toolName: event.toolName,
          output: event.output,
        };
        socketService.emitToPod(
          podId,
          WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
          toolResultPayload
        );
        break;
      }

      case 'complete': {
        const completePayload: PodChatCompletePayload = {
          podId,
          messageId,
          fullContent: accumulatedContent,
        };
        socketService.emitToPod(
          podId,
          WebSocketResponseEvents.POD_CHAT_COMPLETE,
          completePayload
        );
        break;
      }

      case 'error': {
        console.error(`[Chat] Stream error for Pod ${podId}: ${event.error}`);
        break;
      }
    }
  });

  podStore.setStatus(podId, 'idle');
  podStore.updateLastActive(podId);

  // Check if auto-clear should be triggered (for standalone POD)
  autoClearService.onPodComplete(podId).catch((error) => {
    console.error(`[Chat] Failed to check auto-clear for Pod ${podId}:`, error);
  });

  workflowService.checkAndTriggerWorkflows(podId).catch((error) => {
    console.error(`[Chat] Failed to check auto-trigger workflows for Pod ${podId}:`, error);
  });

  console.log(`[Chat] Completed message processing for Pod ${podId}`);
}

export async function handleChatHistory(
  socket: Socket,
  payload: ChatHistoryPayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  console.log(`[Chat] Loading chat history for Pod ${podId}`);

  // Check if Pod exists
  const pod = podStore.getById(podId);
  if (!pod) {
    const responsePayload: PodChatHistoryResultPayload = {
      requestId,
      success: false,
      error: `Pod not found: ${podId}`,
    };

    socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);

    console.error(`[Chat] Failed to load chat history: Pod not found: ${podId}`);
    return;
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
}
