import type {Socket} from 'socket.io';
import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {
    PodChatMessagePayload,
    PodChatToolUsePayload,
    PodChatToolResultPayload,
    PodChatCompletePayload,
    ContentBlock,
} from '../types/index.js';
import type {ChatSendPayload, ChatHistoryPayload} from '../schemas/index.js';
import {podStore} from '../services/podStore.js';
import {messageStore} from '../services/messageStore.js';
import {claudeQueryService} from '../services/claude/queryService.js';
import {socketService} from '../services/socketService.js';
import {workflowExecutionService} from '../services/workflow/index.js';
import {autoClearService} from '../services/autoClear/index.js';
import {emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {validatePod, withCanvasId} from '../utils/handlerHelpers.js';
import {
    createSubMessageState,
    createSubMessageFlusher,
    processTextEvent,
    processToolUseEvent,
    processToolResultEvent,
} from '../services/claude/streamEventProcessor.js';

function extractDisplayContent(message: string | ContentBlock[]): string {
    if (typeof message === 'string') return message;

    return message
        .map((block) => block.type === 'text' ? block.text : '[image]')
        .join('');
}

export const handleChatSend = withCanvasId<ChatSendPayload>(
    WebSocketResponseEvents.POD_ERROR,
    async (socket: Socket, canvasId: string, payload: ChatSendPayload, requestId: string): Promise<void> => {
        const {podId, message} = payload;

        const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_ERROR, requestId);
        if (!pod) return;

        if (pod.status === 'chatting' || pod.status === 'summarizing') {
            emitError(
                socket,
                WebSocketResponseEvents.POD_ERROR,
                `Pod ${podId} is currently ${pod.status}, please wait`,
                requestId,
                podId,
                'POD_BUSY'
            );
            return;
        }

        podStore.setStatus(canvasId, podId, 'chatting');

        const messageId = uuidv4();
        const accumulatedContentRef = {value: ''};
        const subMessageState = createSubMessageState();
        const flushCurrentSubMessage = createSubMessageFlusher(messageId, subMessageState);

        const userDisplayContent = extractDisplayContent(message);
        socketService.emitToCanvas(
            canvasId,
            WebSocketResponseEvents.POD_CHAT_USER_MESSAGE,
            {
                canvasId,
                podId,
                messageId: uuidv4(),
                content: userDisplayContent,
                timestamp: new Date().toISOString(),
            }
        );

        await claudeQueryService.sendMessage(podId, message, (event) => {
            switch (event.type) {
                case 'text': {
                    processTextEvent(event.content, accumulatedContentRef, subMessageState);

                    const textPayload: PodChatMessagePayload = {
                        canvasId,
                        podId,
                        messageId,
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
                        podId,
                        messageId,
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
                        podId,
                        messageId,
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
                        podId,
                        messageId,
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
                    logger.error('Chat', 'Error', `Stream error for Pod ${podId}: ${event.error}`);
                    break;
                }
            }
        });

        const userMessageText = extractDisplayContent(message);
        await messageStore.addMessage(canvasId, podId, 'user', userMessageText);

        if (accumulatedContentRef.value || subMessageState.subMessages.length > 0) {
            await messageStore.addMessage(
                canvasId,
                podId,
                'assistant',
                accumulatedContentRef.value,
                subMessageState.subMessages.length > 0 ? subMessageState.subMessages : undefined
            );
        }

        podStore.setStatus(canvasId, podId, 'idle');
        podStore.updateLastActive(canvasId, podId);

        autoClearService.onPodComplete(canvasId, podId).catch((error) => {
            logger.error('AutoClear', 'Error', `Failed to check auto-clear for Pod ${podId}`, error);
        });

        workflowExecutionService.checkAndTriggerWorkflows(canvasId, podId).catch((error) => {
            logger.error('Workflow', 'Error', `Failed to check auto-trigger workflows for Pod ${podId}`, error);
        });
    }
);

export const handleChatHistory = withCanvasId<ChatHistoryPayload>(
    WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
    async (socket: Socket, canvasId: string, payload: ChatHistoryPayload, requestId: string): Promise<void> => {
        const {podId} = payload;

        const pod = podStore.getById(canvasId, podId);
        if (!pod) {
            socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, {
                requestId,
                success: false,
                error: `Pod 找不到: ${podId}`,
            });
            return;
        }

        const messages = messageStore.getMessages(podId);
        socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, {
            requestId,
            success: true,
            messages: messages.map((msg) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                subMessages: msg.subMessages,
            })),
        });
    }
);
