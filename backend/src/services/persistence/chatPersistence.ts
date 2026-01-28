import path from 'path';
import { persistenceService } from './index.js';
import type { PersistedMessage, ChatHistory } from '../../types/index.js';
import { Result, ok, err } from '../../types/index.js';
import { config } from '../../config/index.js';

class ChatPersistenceService {
  getChatFilePath(podId: string): string {
    return path.join(config.canvasRoot, `pod-${podId}`, 'chat.json');
  }

  async saveMessage(podId: string, message: PersistedMessage): Promise<Result<void>> {
    const filePath = this.getChatFilePath(podId);

    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    if (!readResult.success) {
      return err(`儲存訊息失敗 (Pod ${podId})`);
    }

    let chatHistory = readResult.data;
    if (!chatHistory) {
      chatHistory = {
        messages: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    chatHistory.messages.push(message);
    chatHistory.lastUpdated = new Date().toISOString();

    const writeResult = await persistenceService.writeJson(filePath, chatHistory);
    if (!writeResult.success) {
      return err(`儲存訊息失敗 (Pod ${podId})`);
    }

    return ok(undefined);
  }

  async loadChatHistory(podId: string): Promise<ChatHistory | null> {
    const filePath = this.getChatFilePath(podId);
    const result = await persistenceService.readJson<ChatHistory>(filePath);

    if (!result.success) {
      return null;
    }

    return result.data ?? null;
  }

  async clearChatHistory(podId: string): Promise<Result<void>> {
    const filePath = this.getChatFilePath(podId);

    const result = await persistenceService.deleteFile(filePath);
    if (!result.success) {
      return err(`清除聊天紀錄失敗 (Pod ${podId})`);
    }

    return ok(undefined);
  }
}

export const chatPersistenceService = new ChatPersistenceService();
