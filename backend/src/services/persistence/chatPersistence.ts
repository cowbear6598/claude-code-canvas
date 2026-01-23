import path from 'path';
import { persistenceService } from './index.js';
import type { PersistedMessage, ChatHistory } from '../../types/index.js';
import { config } from '../../config/index.js';

class ChatPersistenceService {
  getChatFilePath(podId: string): string {
    return path.join(config.workspaceRoot, `pod-${podId}`, 'chat.json');
  }

  async saveMessage(podId: string, message: PersistedMessage): Promise<void> {
    const filePath = this.getChatFilePath(podId);

    try {
      let chatHistory = await persistenceService.readJson<ChatHistory>(filePath);

      if (!chatHistory) {
        chatHistory = {
          messages: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      chatHistory.messages.push(message);
      chatHistory.lastUpdated = new Date().toISOString();

      await persistenceService.writeJson(filePath, chatHistory);

      console.log(`[ChatPersistence] Saved message ${message.id} to Pod ${podId}`);
    } catch (error) {
      console.error(`[ChatPersistence] Failed to save message for Pod ${podId}: ${error}`);
      throw error;
    }
  }

  async loadChatHistory(podId: string): Promise<ChatHistory | null> {
    const filePath = this.getChatFilePath(podId);
    const chatHistory = await persistenceService.readJson<ChatHistory>(filePath);

    if (chatHistory) {
      console.log(`[ChatPersistence] Loaded ${chatHistory.messages.length} messages for Pod ${podId}`);
    }

    return chatHistory;
  }

  async clearChatHistory(podId: string): Promise<void> {
    const filePath = this.getChatFilePath(podId);

    try {
      await persistenceService.deleteFile(filePath);
      console.log(`[ChatPersistence] Cleared chat history for Pod ${podId}`);
    } catch (error) {
      console.error(`[ChatPersistence] Failed to clear chat history for Pod ${podId}: ${error}`);
      throw error;
    }
  }
}

export const chatPersistenceService = new ChatPersistenceService();
