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
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodGitClonePayload,
  type PodGitCloneResultPayload,
  type PodGitCloneProgressPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
} from '../../src/types/index.js';

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
      // 設定 Git Mock 回傳成功
      mockCloneResult = { success: true };

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Git Clone Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      expect(createResponse.success).toBe(true);
      expect(createResponse.pod).toBeDefined();

      const podId = createResponse.pod!.id;

      // 加入 Pod Room 以接收 progress 事件
      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 收集 progress 事件
      const progressEvents: PodGitCloneProgressPayload[] = [];
      const progressHandler = (payload: PodGitCloneProgressPayload) => {
        progressEvents.push(payload);
      };

      client.on(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, progressHandler);

      // 發送 Git Clone 請求
      const clonePayload: PodGitClonePayload = {
        requestId: uuidv4(),
        podId,
        repoUrl: 'https://github.com/example/repo.git',
      };

      const cloneResponse = await emitAndWaitResponse<
        PodGitClonePayload,
        PodGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.POD_GIT_CLONE,
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        clonePayload,
        10000 // 增加超時時間
      );

      // 移除 progress 事件監聽器
      client.off(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, progressHandler);

      // 驗證最終結果
      expect(cloneResponse.success).toBe(true);
      expect(cloneResponse.pod).toBeDefined();
      expect(cloneResponse.pod?.gitUrl).toBe('https://github.com/example/repo.git');

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

      // 驗證所有 progress 事件的 podId 都正確
      progressEvents.forEach((event) => {
        expect(event.podId).toBe(podId);
        expect(event.message).toBeDefined();
      });
    });

    it('Clone 失敗應正確回報錯誤', async () => {
      // 設定 Git Mock 回傳失敗
      mockCloneResult = { success: false, error: 'Repository not found' };

      // 建立 Pod
      const createPayload = createTestPodPayload({ name: 'Git Clone Fail Test Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      expect(createResponse.success).toBe(true);
      const podId = createResponse.pod!.id;

      // 發送 Git Clone 請求
      const clonePayload: PodGitClonePayload = {
        requestId: uuidv4(),
        podId,
        repoUrl: 'https://github.com/invalid/repo.git',
      };

      const cloneResponse = await emitAndWaitResponse<
        PodGitClonePayload,
        PodGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.POD_GIT_CLONE,
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        clonePayload,
        10000
      );

      // 驗證錯誤回應
      expect(cloneResponse.success).toBe(false);
      expect(cloneResponse.error).toBeDefined();
      expect(cloneResponse.error).toContain('複製儲存庫失敗');
    });

    it('Clone 到不存在的 Pod 應回傳錯誤', async () => {
      // 不建立 Pod，直接使用不存在的 ID
      const nonExistentPodId = '00000000-0000-0000-0000-000000000000';

      // 發送 Git Clone 請求
      const clonePayload: PodGitClonePayload = {
        requestId: uuidv4(),
        podId: nonExistentPodId,
        repoUrl: 'https://github.com/example/repo.git',
      };

      const cloneResponse = await emitAndWaitResponse<
        PodGitClonePayload,
        PodGitCloneResultPayload
      >(
        client,
        WebSocketRequestEvents.POD_GIT_CLONE,
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        clonePayload,
        10000
      );

      // 驗證錯誤回應
      expect(cloneResponse.success).toBe(false);
      expect(cloneResponse.error).toBeDefined();
      expect(cloneResponse.error).toContain('not found');
    });
  });
});
