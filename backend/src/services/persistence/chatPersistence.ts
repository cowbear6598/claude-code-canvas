import path from 'path';
import { persistenceService } from './index.js';
import type { PersistedMessage, ChatHistory } from '../../types';
import { Result, ok, err } from '../../types';

class ChatPersistenceService {
  getChatFilePath(canvasDir: string, podId: string): string {
    return path.join(canvasDir, `pod-${podId}`, 'chat.json');
  }

  async saveMessage(canvasDir: string, podId: string, message: PersistedMessage): Promise<Result<void>> {
    const filePath = this.getChatFilePath(canvasDir, podId);

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

  async upsertMessage(canvasDir: string, podId: string, message: PersistedMessage): Promise<Result<void>> {
    const filePath = this.getChatFilePath(canvasDir, podId);

    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    if (!readResult.success) {
      return err(`Upsert 訊息失敗 (Pod ${podId})`);
    }

    let chatHistory = readResult.data;
    if (!chatHistory) {
      chatHistory = {
        messages: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const existingIndex = chatHistory.messages.findIndex(msg => msg.id === message.id);
    if (existingIndex >= 0) {
      // 找到則整筆覆蓋
      chatHistory.messages[existingIndex] = message;
    } else {
      // 沒找到則新增
      chatHistory.messages.push(message);
    }

    chatHistory.lastUpdated = new Date().toISOString();

    const writeResult = await persistenceService.writeJson(filePath, chatHistory);
    if (!writeResult.success) {
      return err(`Upsert 訊息失敗 (Pod ${podId})`);
    }

    return ok(undefined);
  }

  async loadChatHistory(canvasDir: string, podId: string): Promise<ChatHistory | null> {
    const filePath = this.getChatFilePath(canvasDir, podId);
    const result = await persistenceService.readJson<ChatHistory>(filePath);

    if (!result.success) {
      return null;
    }

    return result.data ?? null;
  }

  async clearChatHistory(canvasDir: string, podId: string): Promise<Result<void>> {
    const filePath = this.getChatFilePath(canvasDir, podId);

    const result = await persistenceService.deleteFile(filePath);
    if (!result.success) {
      return err(`清除聊天紀錄失敗 (Pod ${podId})`);
    }

    return ok(undefined);
  }
}

export const chatPersistenceService = new ChatPersistenceService();
