import type {Socket} from 'socket.io-client';
import {v4 as uuidv4} from 'uuid';
import {emitAndWaitResponse} from '../setup/index.js';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type ChatSendPayload,
    type ChatHistoryPayload,
} from '../../src/schemas/index.js';
import {
    type PodChatCompletePayload,
    type PodChatHistoryResultPayload,
} from '../../src/types/index.js';

export async function seedPodMessages(
    client: Socket,
    podId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
    if (!client.id) {
        throw new Error('Socket not connected');
    }

    const canvasModule = await import('../../src/services/canvasStore.js');
    const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

    if (!canvasId) {
        throw new Error('No active canvas for socket');
    }

    for (const message of messages) {
        if (message.role === 'user') {
            const payload: ChatSendPayload = {
                requestId: uuidv4(),
                canvasId,
                podId,
                message: message.content,
            };

            await emitAndWaitResponse<ChatSendPayload, PodChatCompletePayload>(
                client,
                WebSocketRequestEvents.POD_CHAT_SEND,
                WebSocketResponseEvents.POD_CHAT_COMPLETE,
                payload
            );
        }
    }
}