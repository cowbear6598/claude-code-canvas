import {v4 as uuidv4} from 'uuid';
import type {PersistedMessage, PersistedSubMessage} from '../types/index.js';
import {Result, ok, err} from '../types/index.js';
import {chatPersistenceService} from './persistence/chatPersistence.js';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';

class MessageStore {
    private messagesByPodId: Map<string, PersistedMessage[]> = new Map();

    async addMessage(
        canvasId: string,
        podId: string,
        role: 'user' | 'assistant',
        content: string,
        subMessages?: PersistedSubMessage[]
    ): Promise<Result<PersistedMessage>> {
        const message: PersistedMessage = {
            id: uuidv4(),
            role,
            content,
            timestamp: new Date().toISOString(),
            ...(subMessages && { subMessages }),
        };

        const messages = this.messagesByPodId.get(podId) ?? [];
        messages.push(message);
        this.messagesByPodId.set(podId, messages);

        const canvasDir = canvasStore.getCanvasDir(canvasId);
        if (!canvasDir) {
            logger.error('Chat', 'Error', `[MessageStore] Canvas not found for Pod ${podId}`);
            return err(`Canvas 不存在 (${canvasId})`);
        }

        const result = await chatPersistenceService.saveMessage(canvasDir, podId, message);
        if (!result.success) {
            logger.error('Chat', 'Error', `[MessageStore] Failed to persist message for Pod ${podId}: ${result.error}`);
            return err(`訊息已儲存至記憶體，但持久化失敗 (Pod ${podId})`);
        }

        return ok(message);
    }

    getMessages(podId: string): PersistedMessage[] {
        return this.messagesByPodId.get(podId) || [];
    }

    async loadMessagesFromDisk(canvasDir: string, podId: string): Promise<Result<PersistedMessage[]>> {
        const chatHistory = await chatPersistenceService.loadChatHistory(canvasDir, podId);

        if (!chatHistory || chatHistory.messages.length === 0) {
            return ok([]);
        }

        this.messagesByPodId.set(podId, chatHistory.messages);
        logger.log('Chat', 'Load', `[MessageStore] Loaded ${chatHistory.messages.length} messages for Pod ${podId}`);
        return ok(chatHistory.messages);
    }

    clearMessages(podId: string): void {
        this.messagesByPodId.delete(podId);
    }

    async clearMessagesWithPersistence(canvasId: string, podId: string): Promise<Result<void>> {
        this.clearMessages(podId);

        const canvasDir = canvasStore.getCanvasDir(canvasId);
        if (!canvasDir) {
            logger.error('Chat', 'Error', `[MessageStore] Canvas not found for Pod ${podId}`);
            return err(`Canvas 不存在 (${canvasId})`);
        }

        const result = await chatPersistenceService.clearChatHistory(canvasDir, podId);
        if (!result.success) {
            logger.error('Chat', 'Error', `[MessageStore] Failed to clear persistence for Pod ${podId}: ${result.error}`);
            return err(`清除訊息失敗 (Pod ${podId})`);
        }

        return ok(undefined);
    }
}

export const messageStore = new MessageStore();
