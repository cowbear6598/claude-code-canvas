// Pod 完整生命週期測試
// 測試 Pod 從建立、配置、對話到清除的完整流程

import '../mocks/claudeSdkMock.js';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  waitForEvent,
  disconnectSocket,
  testConfig,
  type TestServerInstance,
} from '../setup/index.js';
import {
  createTestPodPayload,
} from '../fixtures/index.js';
import {
  setMockResponse,
  resetMock,
  createDefaultTextResponse,
} from '../mocks/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
  type PodChatSendPayload,
  type PodChatCompletePayload,
  type PodChatHistoryPayload,
  type PodChatHistoryResultPayload,
  type PodDeletePayload,
  type PodDeletedPayload,
  type PodGetPayload,
  type PodGetResultPayload,
  type PodBindSkillPayload,
  type PodSkillBoundPayload,
  type RepositoryCreatePayload,
  type RepositoryCreatedPayload,
  type PodBindRepositoryPayload,
  type PodRepositoryBoundPayload,
  type PodBindOutputStylePayload,
  type PodOutputStyleBoundPayload,
} from '../../src/types/index.js';

describe('Pod 完整生命週期', () => {
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
    resetMock();
  });

  afterEach(async () => {
    resetMock();
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  it('Pod 完整生命週期測試', async () => {
    // 設定 Mock 回應
    const expectedContent = 'Pod lifecycle test response';
    setMockResponse(createDefaultTextResponse(expectedContent));

    // 1. 建立 Pod
    const podPayload: PodCreatePayload = createTestPodPayload({
      name: 'Lifecycle Test Pod',
      type: 'General AI',
      color: 'blue',
    });

    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    expect(podResponse.pod).toBeDefined();
    const podId = podResponse.pod!.id;

    // 2. 設定 Mock Skill 並綁定到 Pod
    await fs.mkdir(testConfig.skillsPath, { recursive: true });
    const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
    await fs.mkdir(testSkillDir, { recursive: true });
    await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill for Lifecycle');

    const skillBindPayload: PodBindSkillPayload = {
      requestId: uuidv4(),
      podId,
      skillId: 'test-skill',
    };

    const skillBindResponse = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
      client,
      WebSocketRequestEvents.POD_BIND_SKILL,
      WebSocketResponseEvents.POD_SKILL_BOUND,
      skillBindPayload
    );

    expect(skillBindResponse.success).toBe(true);
    expect(skillBindResponse.pod?.skillIds).toContain('test-skill');

    // 3. 建立 Repository 並綁定到 Pod
    const repoPayload: RepositoryCreatePayload = {
      requestId: uuidv4(),
      name: 'test-repo-lifecycle',
    };

    const repoResponse = await emitAndWaitResponse<
      RepositoryCreatePayload,
      RepositoryCreatedPayload
    >(
      client,
      WebSocketRequestEvents.REPOSITORY_CREATE,
      WebSocketResponseEvents.REPOSITORY_CREATED,
      repoPayload
    );

    expect(repoResponse.success).toBe(true);
    const repositoryId = repoResponse.repository!.id;

    const repoBindPayload: PodBindRepositoryPayload = {
      requestId: uuidv4(),
      podId,
      repositoryId,
    };

    const repoBindResponse = await emitAndWaitResponse<
      PodBindRepositoryPayload,
      PodRepositoryBoundPayload
    >(
      client,
      WebSocketRequestEvents.POD_BIND_REPOSITORY,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND,
      repoBindPayload
    );

    expect(repoBindResponse.success).toBe(true);
    expect(repoBindResponse.pod?.repositoryId).toBe(repositoryId);

    // 4. 設定 Mock OutputStyle 並綁定到 Pod
    await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
    await fs.writeFile(
      path.join(testConfig.outputStylesPath, 'test-style.md'),
      '# Test OutputStyle for Lifecycle'
    );

    const outputStyleBindPayload: PodBindOutputStylePayload = {
      requestId: uuidv4(),
      podId,
      outputStyleId: 'test-style',
    };

    const outputStyleBindResponse = await emitAndWaitResponse<
      PodBindOutputStylePayload,
      PodOutputStyleBoundPayload
    >(
      client,
      WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      outputStyleBindPayload
    );

    expect(outputStyleBindResponse.success).toBe(true);
    expect(outputStyleBindResponse.pod?.outputStyleId).toBe('test-style');

    // 5. 加入 Pod Room
    await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
      client,
      WebSocketRequestEvents.POD_JOIN,
      WebSocketResponseEvents.POD_JOINED,
      { podId }
    );

    // 6. 對 Pod 發送聊天訊息
    const chatPayload: PodChatSendPayload = {
      requestId: uuidv4(),
      podId,
      message: 'Test lifecycle message',
    };

    const completePromise = waitForEvent<PodChatCompletePayload>(
      client,
      WebSocketResponseEvents.POD_CHAT_COMPLETE,
      10000
    );

    client.emit(WebSocketRequestEvents.POD_CHAT_SEND, chatPayload);

    // 等待回應完成
    const completeEvent = await completePromise;

    expect(completeEvent.podId).toBe(podId);
    expect(completeEvent.fullContent).toBe(expectedContent);
    expect(completeEvent.messageId).toBeDefined();

    // 7. 驗證 Pod 的所有綁定都已正確設定
    const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.pod).toBeDefined();
    expect(getResponse.pod?.skillIds).toContain('test-skill');
    expect(getResponse.pod?.repositoryId).toBe(repositoryId);
    expect(getResponse.pod?.outputStyleId).toBe('test-style');

    // 8. 查詢聊天歷史
    await new Promise((resolve) => setTimeout(resolve, 100));

    const historyPayload: PodChatHistoryPayload = {
      requestId: uuidv4(),
      podId,
    };

    const historyResponse = await emitAndWaitResponse<
      PodChatHistoryPayload,
      PodChatHistoryResultPayload
    >(
      client,
      WebSocketRequestEvents.POD_CHAT_HISTORY,
      WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
      historyPayload
    );

    expect(historyResponse.success).toBe(true);
    expect(historyResponse.messages).toBeDefined();
    expect(historyResponse.messages!.length).toBeGreaterThan(0);

    // 9. 刪除 Pod
    const deletePayload: PodDeletePayload = { requestId: uuidv4(), podId };
    const deleteResponse = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
      client,
      WebSocketRequestEvents.POD_DELETE,
      WebSocketResponseEvents.POD_DELETED,
      deletePayload
    );

    expect(deleteResponse.success).toBe(true);
    expect(deleteResponse.podId).toBe(podId);

    // 10. 驗證 Pod 已刪除
    const getAfterDeletePayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getAfterDeleteResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getAfterDeletePayload
    );

    expect(getAfterDeleteResponse.success).toBe(false);
    expect(getAfterDeleteResponse.error).toBeDefined();
  });
});
