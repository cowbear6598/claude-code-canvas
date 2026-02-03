import type {Socket} from 'socket.io';
import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {
    PodChatHistoryResultPayload,
    PodChatMessagePayload,
    PodChatToolUsePayload,
    PodChatToolResultPayload,
    PodChatCompletePayload,
    PersistedSubMessage,
    PersistedToolUseInfo,
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

function extractDisplayContent(message: string | ContentBlock[]): string {
    if (typeof message === 'string') {
        return message;
    }

    return message
        .map((block) => block.type === 'text' ? block.text : '[image]')
        .join('');
}

export const handleChatSend = withCanvasId<ChatSendPayload>(
    WebSocketResponseEvents.POD_ERROR,
    async (socket: Socket, canvasId: string, payload: ChatSendPayload, requestId: string): Promise<void> => {
        const {podId, message} = payload;

        const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_ERROR, requestId);

        if (!pod) {
            return;
        }

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

    let accumulatedContent = '';
    const subMessages: PersistedSubMessage[] = [];
    let currentSubContent = '';
    let currentSubToolUse: PersistedToolUseInfo[] = [];
    let subMessageCounter = 0;

    const flushCurrentSubMessage = (): void => {
        if (currentSubContent || currentSubToolUse.length > 0) {
            subMessages.push({
                id: `${messageId}-sub-${subMessageCounter++}`,
                content: currentSubContent,
                toolUse: currentSubToolUse.length > 0 ? [...currentSubToolUse] : undefined,
            });
            currentSubContent = '';
            currentSubToolUse = [];
        }
    };

    const userDisplayContent = extractDisplayContent(message);
    socket.to(`pod:${podId}`).emit(
        WebSocketResponseEvents.BROADCAST_POD_CHAT_USER_MESSAGE,
        {
            podId,
            messageId: uuidv4(),
            content: userDisplayContent,
            timestamp: new Date().toISOString(),
        }
    );

    await claudeQueryService.sendMessage(podId, message, (event) => {
        switch (event.type) {
            case 'text': {
                accumulatedContent += event.content;
                currentSubContent += event.content;

                const textPayload: PodChatMessagePayload = {
                    podId,
                    messageId,
                    content: accumulatedContent,
                    isPartial: true,
                    role: 'assistant',
                };
                socketService.emitToPod(
                    podId,
                    WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
                    textPayload
                );
                break;
            }

            case 'tool_use': {
                currentSubToolUse.push({
                    toolUseId: event.toolUseId,
                    toolName: event.toolName,
                    input: event.input,
                    status: 'completed',
                });
                flushCurrentSubMessage();

                const toolUsePayload: PodChatToolUsePayload = {
                    podId,
                    messageId,
                    toolUseId: event.toolUseId,
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
                for (const sub of subMessages) {
                    if (sub.toolUse) {
                        const tool = sub.toolUse.find(t => t.toolUseId === event.toolUseId);
                        if (tool) {
                            tool.output = event.output;
                            break;
                        }
                    }
                }
                const currentTool = currentSubToolUse.find(t => t.toolUseId === event.toolUseId);
                if (currentTool) {
                    currentTool.output = event.output;
                }

                const toolResultPayload: PodChatToolResultPayload = {
                    podId,
                    messageId,
                    toolUseId: event.toolUseId,
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
                flushCurrentSubMessage();

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
                logger.error('Chat', 'Error', `Stream error for Pod ${podId}: ${event.error}`);
                break;
            }
        }
    });

    const userMessageText = extractDisplayContent(message);
    await messageStore.addMessage(canvasId, podId, 'user', userMessageText);

    if (accumulatedContent || subMessages.length > 0) {
        await messageStore.addMessage(canvasId, podId, 'assistant', accumulatedContent, subMessages.length > 0 ? subMessages : undefined);
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
        const responsePayload: PodChatHistoryResultPayload = {
            requestId,
            success: false,
            error: `Pod 找不到: ${podId}`,
        };

        socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);
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
            subMessages: msg.subMessages,
        })),
    };

        socket.emit(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, responsePayload);
    }
);
