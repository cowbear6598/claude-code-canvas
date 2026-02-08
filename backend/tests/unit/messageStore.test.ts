import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { messageStore } from '../../src/services/messageStore';
import { canvasStore } from '../../src/services/canvasStore';
import { chatPersistenceService } from '../../src/services/persistence/chatPersistence';
import type { PersistedMessage } from '../../src/types';

// 相容 Node.js 和 Bun：import.meta.dir 是 Bun 專屬，Node.js 需要用 fileURLToPath
const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));

describe('MessageStore upsertMessage', () => {
  let tempDir: string;
  const canvasId = 'test-canvas-1';
  const podId = 'test-pod-1';
  let getCanvasDirSpy: any;

  beforeEach(async () => {
    // 建立臨時測試目錄
    tempDir = join(__dirname, `temp-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Mock canvasStore.getCanvasDir 回傳測試目錄
    getCanvasDirSpy = vi.spyOn(canvasStore, 'getCanvasDir').mockReturnValue(tempDir);

    // 清空記憶體中的訊息並等待之前的寫入佇列完成
    await messageStore.flushWrites(podId);
    messageStore.clearMessages(podId);
  });

  afterEach(async () => {
    // 清理
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('記憶體中無該 message 時新增', () => {
    const message: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    };

    messageStore.upsertMessage(canvasId, podId, message);

    const messages = messageStore.getMessages(podId);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-1');
    expect(messages[0].content).toBe('Hello');
  });

  it('記憶體中已有該 message 時更新', () => {
    const message1: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Original',
      timestamp: new Date().toISOString(),
    };

    messageStore.upsertMessage(canvasId, podId, message1);

    const message2: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Updated',
      timestamp: new Date().toISOString(),
    };

    messageStore.upsertMessage(canvasId, podId, message2);

    const messages = messageStore.getMessages(podId);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-1');
    expect(messages[0].content).toBe('Updated');
  });

  it('連續快速呼叫時，寫入佇列保證順序執行不遺漏', async () => {
    // Mock chatPersistenceService.upsertMessage 來追蹤呼叫
    const callOrder: string[] = [];
    const originalUpsert = chatPersistenceService.upsertMessage.bind(chatPersistenceService);

    chatPersistenceService.upsertMessage = vi.fn(async (canvasDir: string, podId: string, message: PersistedMessage) => {
      callOrder.push(message.content);
      return originalUpsert(canvasDir, podId, message);
    });

    // 連續快速呼叫 3 次（不 await）
    messageStore.upsertMessage(canvasId, podId, {
      id: 'msg-1',
      role: 'assistant',
      content: 'First',
      timestamp: new Date().toISOString(),
    });

    messageStore.upsertMessage(canvasId, podId, {
      id: 'msg-1',
      role: 'assistant',
      content: 'Second',
      timestamp: new Date().toISOString(),
    });

    messageStore.upsertMessage(canvasId, podId, {
      id: 'msg-1',
      role: 'assistant',
      content: 'Third',
      timestamp: new Date().toISOString(),
    });

    // 等待所有寫入完成
    await messageStore.flushWrites(podId);

    // 驗證呼叫了 3 次，且順序正確
    expect(callOrder).toHaveLength(3);
    expect(callOrder[0]).toBe('First');
    expect(callOrder[1]).toBe('Second');
    expect(callOrder[2]).toBe('Third');
  });

  it('最終一致性：最後一次呼叫的結果確實被持久化', async () => {
    // 連續呼叫多次
    for (let i = 1; i <= 5; i++) {
      messageStore.upsertMessage(canvasId, podId, {
        id: 'msg-1',
        role: 'assistant',
        content: `Content ${i}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 等待所有寫入完成
    await messageStore.flushWrites(podId);

    // 驗證磁碟上的內容是最後一次的值
    const chatHistory = await chatPersistenceService.loadChatHistory(tempDir, podId);
    expect(chatHistory?.messages).toHaveLength(1);
    expect(chatHistory?.messages[0].id).toBe('msg-1');
    expect(chatHistory?.messages[0].content).toBe('Content 5');
  });
});
