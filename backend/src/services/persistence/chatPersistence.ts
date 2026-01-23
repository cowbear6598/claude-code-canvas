// Chat Persistence Service
// Manages chat history storage on disk

import path from 'path';
import { persistenceService } from './index.js';
import type { PersistedMessage, ChatHistory } from '../../types/index.js';
import { config } from '../../config/index.js';

class ChatPersistenceService {
  /**
   * Get the file path for a Pod's chat history
   * @param podId Pod identifier
   * @returns Absolute path to chat.json
   */
  getChatFilePath(podId: string): string {
    return path.join(config.workspaceRoot, `pod-${podId}`, 'chat.json');
  }

  /**
   * Save a message to chat history
   * @param podId Pod identifier
   * @param message Message to append
   */
  async saveMessage(podId: string, message: PersistedMessage): Promise<void> {
    const filePath = this.getChatFilePath(podId);

    try {
      // Load existing chat history or create new
      let chatHistory = await persistenceService.readJson<ChatHistory>(filePath);

      if (!chatHistory) {
        chatHistory = {
          messages: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      // Append new message
      chatHistory.messages.push(message);
      chatHistory.lastUpdated = new Date().toISOString();

      // Save to disk
      await persistenceService.writeJson(filePath, chatHistory);

      console.log(`[ChatPersistence] Saved message ${message.id} to Pod ${podId}`);
    } catch (error) {
      console.error(`[ChatPersistence] Failed to save message for Pod ${podId}: ${error}`);
      throw error;
    }
  }

  /**
   * Load chat history for a Pod
   * @param podId Pod identifier
   * @returns ChatHistory or null if not found
   */
  async loadChatHistory(podId: string): Promise<ChatHistory | null> {
    const filePath = this.getChatFilePath(podId);
    const chatHistory = await persistenceService.readJson<ChatHistory>(filePath);

    if (chatHistory) {
      console.log(`[ChatPersistence] Loaded ${chatHistory.messages.length} messages for Pod ${podId}`);
    }

    return chatHistory;
  }

  /**
   * Clear chat history for a Pod
   * @param podId Pod identifier
   */
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

// Export singleton instance
export const chatPersistenceService = new ChatPersistenceService();
