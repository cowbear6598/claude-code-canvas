import {v4 as uuidv4} from 'uuid';

import {WebSocketResponseEvents} from '../../schemas';
import {isAbortError} from '../../utils/errorHelpers.js';
import type {
    ContentBlock,
    PodChatCompletePayload,
    PodChatMessagePayload,
    PodChatToolResultPayload,
    PodChatToolUsePayload,
} from '../../types';

import {claudeQueryService} from './queryService.js';
import type {StreamEvent} from './queryService.js';
import {
    buildPersistedMessage,
    createSubMessageFlusher,
    createSubMessageState,
    processTextEvent,
    processToolResultEvent,
    processToolUseEvent,
} from './streamEventProcessor.js';
import {messageStore} from '../messageStore.js';
import {podStore} from '../podStore.js';
import {socketService} from '../socketService.js';
import {logger} from '../../utils/logger.js';

export interface StreamingChatExecutorOptions {
    canvasId: string;
    podId: string;
    message: string | ContentBlock[];
    connectionId: string;
    supportAbort: boolean;
}

export interface StreamingChatExecutorCallbacks {
    onComplete?: (canvasId: string, podId: string) => void | Promise<void>;
    onError?: (canvasId: string, podId: string, error: Error) => void | Promise<void>;
    onAborted?: (canvasId: string, podId: string, messageId: string) => void | Promise<void>;
}

export interface StreamingChatExecutorResult {
    messageId: string;
    content: string;
    hasContent: boolean;
    aborted: boolean;
}

/** 建立統一的 streaming 事件處理 callback */
function createStreamingCallback(
    canvasId: string,
    podId: string,
    messageId: string,
    accumulatedContentRef: {value: string},
    subMessageState: ReturnType<typeof createSubMessageState>,
    flushCurrentSubMessage: () => void,
    persistStreamingMessage: () => void
): (event: StreamEvent) => void {
    return (event: StreamEvent) => {
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

                persistStreamingMessage();
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

                persistStreamingMessage();
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

                persistStreamingMessage();
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
                logger.error('Chat', 'Error', `Pod ${podId} streaming 過程發生錯誤`);
                break;
            }
        }
    };
}

export async function executeStreamingChat(
    options: StreamingChatExecutorOptions,
    callbacks?: StreamingChatExecutorCallbacks
): Promise<StreamingChatExecutorResult> {
    const {canvasId, podId, message, connectionId, supportAbort} = options;

    const messageId = uuidv4();
    const accumulatedContentRef = {value: ''};
    const subMessageState = createSubMessageState();
    const flushCurrentSubMessage = createSubMessageFlusher(messageId, subMessageState);

    const persistStreamingMessage = (): void => {
        const persistedMsg = buildPersistedMessage(messageId, accumulatedContentRef.value, subMessageState);
        messageStore.upsertMessage(canvasId, podId, persistedMsg);
    };

    const streamingCallback = createStreamingCallback(
        canvasId,
        podId,
        messageId,
        accumulatedContentRef,
        subMessageState,
        flushCurrentSubMessage,
        persistStreamingMessage
    );

    try {
        await claudeQueryService.sendMessage(podId, message, streamingCallback, connectionId);

        const hasAssistantContent = accumulatedContentRef.value || subMessageState.subMessages.length > 0;
        if (hasAssistantContent) {
            persistStreamingMessage();
            await messageStore.flushWrites(podId);
        }

        podStore.setStatus(canvasId, podId, 'idle');
        podStore.updateLastActive(canvasId, podId);

        if (callbacks?.onComplete) {
            await callbacks.onComplete(canvasId, podId);
        }

        return {
            messageId,
            content: accumulatedContentRef.value,
            hasContent: !!hasAssistantContent,
            aborted: false,
        };
    } catch (error) {
        if (isAbortError(error) && supportAbort) {
            flushCurrentSubMessage();

            const hasAssistantContent = accumulatedContentRef.value || subMessageState.subMessages.length > 0;
            if (hasAssistantContent) {
                persistStreamingMessage();
                await messageStore.flushWrites(podId);
            }

            podStore.setStatus(canvasId, podId, 'idle');

            if (callbacks?.onAborted) {
                await callbacks.onAborted(canvasId, podId, messageId);
            }

            return {
                messageId,
                content: accumulatedContentRef.value,
                hasContent: !!hasAssistantContent,
                aborted: true,
            };
        }

        podStore.setStatus(canvasId, podId, 'idle');

        if (callbacks?.onError) {
            await callbacks.onError(canvasId, podId, error as Error);
        }

        throw error;
    }
}
