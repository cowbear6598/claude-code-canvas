import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chatPersistenceService } from '../../src/services/persistence/chatPersistence';
import { persistenceService } from '../../src/services/persistence';
import type { PersistedMessage, ChatHistory } from '../../src/types';

// 相容 Node.js 和 Bun：import.meta.dir 是 Bun 專屬，Node.js 需要用 fileURLToPath
const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));

describe('ChatPersistenceService upsertMessage', () => {
  let tempDir: string;
  const podId = 'test-pod-1';

  beforeEach(async () => {
    // 建立臨時測試目錄
    tempDir = join(__dirname, `temp-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理臨時目錄
    await rm(tempDir, { recursive: true, force: true });
  });

  it('chat.json 不存在時建立新檔案並寫入 message', async () => {
    const message: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello, world!',
      timestamp: new Date().toISOString(),
    };

    const result = await chatPersistenceService.upsertMessage(tempDir, podId, message);
    expect(result.success).toBe(true);

    // 驗證檔案內容
    const filePath = chatPersistenceService.getChatFilePath(tempDir, podId);
    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    expect(readResult.success).toBe(true);
    expect(readResult.data?.messages).toHaveLength(1);
    expect(readResult.data?.messages[0].id).toBe('msg-1');
    expect(readResult.data?.messages[0].content).toBe('Hello, world!');
  });

  it('message id 不存在時 push 新 message', async () => {
    // 預先建立一筆 message
    const message1: PersistedMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'First message',
      timestamp: new Date().toISOString(),
    };
    await chatPersistenceService.upsertMessage(tempDir, podId, message1);

    // 新增不同 id 的 message
    const message2: PersistedMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Second message',
      timestamp: new Date().toISOString(),
    };
    const result = await chatPersistenceService.upsertMessage(tempDir, podId, message2);
    expect(result.success).toBe(true);

    // 驗證有兩筆 messages
    const filePath = chatPersistenceService.getChatFilePath(tempDir, podId);
    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    expect(readResult.data?.messages).toHaveLength(2);
    expect(readResult.data?.messages[0].id).toBe('msg-1');
    expect(readResult.data?.messages[1].id).toBe('msg-2');
  });

  it('message id 已存在時更新該 message', async () => {
    // 預先建立一筆 message
    const message1: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Original content',
      timestamp: new Date().toISOString(),
    };
    await chatPersistenceService.upsertMessage(tempDir, podId, message1);

    // 更新相同 id 的 message
    const message2: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Updated content',
      timestamp: new Date().toISOString(),
    };
    const result = await chatPersistenceService.upsertMessage(tempDir, podId, message2);
    expect(result.success).toBe(true);

    // 驗證仍然只有一筆，且內容已更新
    const filePath = chatPersistenceService.getChatFilePath(tempDir, podId);
    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    expect(readResult.data?.messages).toHaveLength(1);
    expect(readResult.data?.messages[0].id).toBe('msg-1');
    expect(readResult.data?.messages[0].content).toBe('Updated content');
  });

  it('連續呼叫不會產生重複', async () => {
    const message: PersistedMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Content 1',
      timestamp: new Date().toISOString(),
    };

    // 連續呼叫 3 次，每次 content 不同
    await chatPersistenceService.upsertMessage(tempDir, podId, message);

    message.content = 'Content 2';
    await chatPersistenceService.upsertMessage(tempDir, podId, message);

    message.content = 'Content 3';
    await chatPersistenceService.upsertMessage(tempDir, podId, message);

    // 驗證只有 1 筆，content 為最後一次的值
    const filePath = chatPersistenceService.getChatFilePath(tempDir, podId);
    const readResult = await persistenceService.readJson<ChatHistory>(filePath);
    expect(readResult.data?.messages).toHaveLength(1);
    expect(readResult.data?.messages[0].id).toBe('msg-1');
    expect(readResult.data?.messages[0].content).toBe('Content 3');
  });
});
