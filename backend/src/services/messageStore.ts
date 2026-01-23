// Message Store
// In-memory message cache with disk persistence

import { v4 as uuidv4 } from 'uuid';
import type { PersistedMessage } from '../types/index.js';
import { chatPersistenceService } from './persistence/chatPersistence.js';

class MessageStore {
  // In-memory cache: Map<podId, messages[]>
  private messagesByPodId: Map<string, PersistedMessage[]> = new Map();

  /**
   * Add a message to the store and persist it
   * @param podId Pod identifier
   * @param role Message role (user or assistant)
   * @param content Message content
   * @returns Created message
   */
  async addMessage(
    podId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<PersistedMessage> {
    // Create message
    const message: PersistedMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    // Add to in-memory cache
    let messages = this.messagesByPodId.get(podId);
    if (!messages) {
      messages = [];
      this.messagesByPodId.set(podId, messages);
    }
    messages.push(message);

    // Persist to disk
    try {
      await chatPersistenceService.saveMessage(podId, message);
      console.log(`[MessageStore] Added and persisted ${role} message for Pod ${podId}`);
    } catch (error) {
      console.error(`[MessageStore] Failed to persist message for Pod ${podId}: ${error}`);
      console.log(`[MessageStore] Message ${message.id} retained in memory only`);
      // Don't throw - message is still in memory
    }

    return message;
  }

  /**
   * Get all messages for a Pod from memory cache
   * @param podId Pod identifier
   * @returns Array of messages (empty if not in cache)
   */
  getMessages(podId: string): PersistedMessage[] {
    return this.messagesByPodId.get(podId) || [];
  }

  /**
   * Load messages from disk into memory cache
   * @param podId Pod identifier
   * @returns Array of loaded messages
   */
  async loadMessagesFromDisk(podId: string): Promise<PersistedMessage[]> {
    try {
      const chatHistory = await chatPersistenceService.loadChatHistory(podId);

      if (chatHistory && chatHistory.messages.length > 0) {
        // Store in memory cache
        this.messagesByPodId.set(podId, chatHistory.messages);
        console.log(`[MessageStore] Loaded ${chatHistory.messages.length} messages for Pod ${podId}`);
        return chatHistory.messages;
      }

      return [];
    } catch (error) {
      console.error(`[MessageStore] Failed to load messages for Pod ${podId}: ${error}`);
      return [];
    }
  }

  /**
   * Clear messages for a Pod from memory cache
   * @param podId Pod identifier
   */
  clearMessages(podId: string): void {
    this.messagesByPodId.delete(podId);
    console.log(`[MessageStore] Cleared messages for Pod ${podId} from cache`);
  }

  /**
   * Get the number of messages for a Pod
   * @param podId Pod identifier
   * @returns Message count
   */
  getMessageCount(podId: string): number {
    const messages = this.messagesByPodId.get(podId);
    return messages ? messages.length : 0;
  }
}

// Export singleton instance
export const messageStore = new MessageStore();
