import { v4 as uuidv4 } from 'uuid';
import type { PersistedMessage } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { chatPersistenceService } from './persistence/chatPersistence.js';

class MessageStore {
  private messagesByPodId: Map<string, PersistedMessage[]> = new Map();

  async addMessage(
    podId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<Result<PersistedMessage>> {
    const message: PersistedMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    const messages = this.messagesByPodId.get(podId) ?? [];
    messages.push(message);
    this.messagesByPodId.set(podId, messages);

    const result = await chatPersistenceService.saveMessage(podId, message);
    if (!result.success) {
      console.error(`[MessageStore] Failed to persist message for Pod ${podId}: ${result.error}`);
      console.log(`[MessageStore] Message ${message.id} retained in memory only`);
      return err(`訊息已儲存至記憶體，但持久化失敗 (Pod ${podId})`);
    }

    console.log(`[MessageStore] Added and persisted ${role} message for Pod ${podId}`);
    return ok(message);
  }

  getMessages(podId: string): PersistedMessage[] {
    return this.messagesByPodId.get(podId) || [];
  }

  async loadMessagesFromDisk(podId: string): Promise<Result<PersistedMessage[]>> {
    const chatHistory = await chatPersistenceService.loadChatHistory(podId);

    if (!chatHistory || chatHistory.messages.length === 0) {
      return ok([]);
    }

    this.messagesByPodId.set(podId, chatHistory.messages);
    console.log(`[MessageStore] Loaded ${chatHistory.messages.length} messages for Pod ${podId}`);
    return ok(chatHistory.messages);
  }

  clearMessages(podId: string): void {
    this.messagesByPodId.delete(podId);
    console.log(`[MessageStore] Cleared messages for Pod ${podId} from cache`);
  }

  getMessageCount(podId: string): number {
    return this.messagesByPodId.get(podId)?.length ?? 0;
  }
}

export const messageStore = new MessageStore();
