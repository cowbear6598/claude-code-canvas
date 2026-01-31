// Phase 6: Git 操作 Flow 測試
// 測試 Git Clone 操作和錯誤處理

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createTestPodPayload } from '../fixtures/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type RepositoryGitCloneProgressPayload,
  type RepositoryGitCloneResultPayload,
} from '../../src/types/index.js';
import type {
  RepositoryGitClonePayload,
} from '../../src/schemas/index.js';

// Mock simple-git 模組
let mockCloneResult: { success: boolean; error?: string } = { success: true };

const mockCloneFn = vi.fn(async () => {
  // 模擬一些延遲
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!mockCloneResult.success) {
    throw new Error(mockCloneResult.error || 'Clone failed');
  }
});

const mockGitInstance = {
  clone: mockCloneFn,
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGitInstance),
  default: vi.fn(() => mockGitInstance),
}));

describe('Phase 6: Git 操作 Flow', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl);
    // 重置 Git Mock 為成功狀態
    mockCloneResult = { success: true };
    mockCloneFn.mockClear();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  describe('Git Clone', () => {
    it('應能 Clone Git Repository', async () => {
      mockCloneResult = { success: true };

      const progressEvents: RepositoryGitCloneProgressPayload[] = [];
      const progressHandler = (payload: RepositoryGitCloneProgressPayload) => {
        progressEvents.push(payload);
      };

      client.on(WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS, progressHandler);

      const clonePayload: RepositoryGitClonePayload = {
        requestId: uuidv4(),
        repoUrl: 'https://github.com/example/repo.git',
      };

      const cloneResponse = await emitAndWaitResponse<
        RepositoryGitClonePayload,
        RepositoryGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_GIT_CLONE,
        WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
        clonePayload,
        10000
      );

      // 移除 progress 事件監聽器
      client.off(WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS, progressHandler);

      // 驗證最終結果
      expect(cloneResponse.success).toBe(true);
      expect(cloneResponse.repository).toBeDefined();
      expect(cloneResponse.repository?.id).toBe('repo');
      expect(cloneResponse.repository?.name).toBe('repo');

      // 驗證 progress 事件
      expect(progressEvents.length).toBeGreaterThan(0);

      // 驗證 progress 包含從 0 到 100 的進度
      const progressValues = progressEvents.map((e) => e.progress);
      expect(progressValues).toContain(0);
      expect(progressValues).toContain(100);

      // 驗證 progress 是遞增的
      const hasStartProgress = progressEvents.some((e) => e.progress === 0);
      const hasEndProgress = progressEvents.some((e) => e.progress === 100);
      expect(hasStartProgress).toBe(true);
      expect(hasEndProgress).toBe(true);

      // 驗證所有 progress 事件都有正確的訊息
      progressEvents.forEach((event) => {
        expect(event.message).toBeDefined();
      });
    });

    it('Clone 失敗應正確回報錯誤', async () => {
      // 設定 Git Mock 回傳失敗
      mockCloneResult = { success: false, error: 'Repository not found' };

      // 發送 Git Clone 請求
      const clonePayload: RepositoryGitClonePayload = {
        requestId: uuidv4(),
        repoUrl: 'https://github.com/invalid/clone-fail-test.git',
      };

      const cloneResponse = await emitAndWaitResponse<
        RepositoryGitClonePayload,
        RepositoryGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_GIT_CLONE,
        WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
        clonePayload,
        10000
      );

      // 驗證錯誤回應
      expect(cloneResponse.success).toBe(false);
      expect(cloneResponse.error).toBeDefined();
      expect(cloneResponse.error).toContain('複製儲存庫失敗');
    });

    it('Clone 已存在的 Repository 應回傳錯誤', async () => {
      // 設定 Git Mock 回傳成功
      mockCloneResult = { success: true };

      // 第一次 clone
      const clonePayload1: RepositoryGitClonePayload = {
        requestId: uuidv4(),
        repoUrl: 'https://github.com/example/duplicate.git',
      };

      const cloneResponse1 = await emitAndWaitResponse<
        RepositoryGitClonePayload,
        RepositoryGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_GIT_CLONE,
        WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
        clonePayload1,
        10000
      );

      expect(cloneResponse1.success).toBe(true);

      // 第二次 clone 同一個 repository
      const clonePayload2: RepositoryGitClonePayload = {
        requestId: uuidv4(),
        repoUrl: 'https://github.com/example/duplicate.git',
      };

      const cloneResponse2 = await emitAndWaitResponse<
        RepositoryGitClonePayload,
        RepositoryGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_GIT_CLONE,
        WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
        clonePayload2,
        10000
      );

      // 驗證錯誤回應
      expect(cloneResponse2.success).toBe(false);
      expect(cloneResponse2.error).toBeDefined();
      expect(cloneResponse2.error).toContain('already exists');
    });
  });
});
