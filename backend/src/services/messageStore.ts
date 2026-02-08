import {v4 as uuidv4} from 'uuid';
import type {PersistedMessage, PersistedSubMessage} from '../types';
import {Result, ok, err} from '../types';
import {chatPersistenceService} from './persistence/chatPersistence.js';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';

class MessageStore {
    private messagesByPodId: Map<string, PersistedMessage[]> = new Map();
    private writeQueues: Map<string, Promise<void>> = new Map();

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

    /**
     * 非同步 upsert 訊息：同步更新記憶體，非同步寫入磁碟（fire-and-forget）
     * 磁碟寫入加入 per-pod 佇列，保證同一 pod 的寫入順序
     * 若需確保寫入完成，呼叫 await flushWrites(podId)
     */
    upsertMessage(canvasId: string, podId: string, message: PersistedMessage): void {
        // 記憶體同步更新
        const messages = this.messagesByPodId.get(podId) ?? [];
        const existingIndex = messages.findIndex(msg => msg.id === message.id);
        if (existingIndex >= 0) {
            messages[existingIndex] = message;
        } else {
            messages.push(message);
        }
        this.messagesByPodId.set(podId, messages);

        // 磁碟 fire-and-forget
        this.enqueueWrite(podId, async () => {
            const canvasDir = canvasStore.getCanvasDir(canvasId);
            if (!canvasDir) {
                logger.error('Chat', 'Error', `[MessageStore] Canvas not found for Pod ${podId} during upsert`);
                return;
            }

            const result = await chatPersistenceService.upsertMessage(canvasDir, podId, message);
            if (!result.success) {
                logger.error('Chat', 'Error', `[MessageStore] Upsert 失敗 (Pod ${podId}): ${result.error}`);
            }
        });
    }

    /** 等待該 Pod 所有排隊中的磁碟寫入完成 */
    flushWrites(podId: string): Promise<void> {
        return this.writeQueues.get(podId) ?? Promise.resolve();
    }

    private enqueueWrite(podId: string, writeFn: () => Promise<void>): void {
        const previousWrite = this.writeQueues.get(podId) ?? Promise.resolve();
        const nextWrite = previousWrite
            .then(() => writeFn())
            .catch((error: unknown) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error('Chat', 'Error', `[MessageStore] 寫入佇列執行失敗 (Pod ${podId}): ${errorMsg}`);
            });
        this.writeQueues.set(podId, nextWrite);
    }
}

export const messageStore = new MessageStore();
