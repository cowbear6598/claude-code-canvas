// Phase 1: Pod 管理 Flow 測試
// 測試 Pod 的完整生命週期、Room 管理和錯誤處理

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
  type PodListPayload,
  type PodListResultPayload,
  type PodGetPayload,
  type PodGetResultPayload,
  type PodUpdatePayload,
  type PodUpdatedPayload,
  type PodDeletePayload,
  type PodDeletedPayload,
  type PodJoinPayload,
  type PodJoinedPayload,
  type PodJoinBatchPayload,
  type PodJoinedBatchPayload,
  type PodLeavePayload,
  type PodLeftPayload,
} from '../../src/types/index.js';

describe('Phase 1: Pod 管理 Flow', () => {
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
  });

  afterEach(async () => {
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  describe('Pod 完整生命週期', () => {
    it('應能建立 Pod 並收到 pod:created 事件', async () => {
      const payload: PodCreatePayload = createTestPodPayload({
        name: 'Test Pod for Creation',
        type: 'General AI',
        color: 'blue',
        x: 100,
        y: 100,
        rotation: 0,
      });

      const response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.pod).toBeDefined();
      expect(response.pod?.id).toBeDefined();
      expect(response.pod?.name).toBe('Test Pod for Creation');
      expect(response.pod?.type).toBe('General AI');
      expect(response.pod?.color).toBe('blue');
      expect(response.pod?.status).toBe('idle');
      expect(response.pod?.x).toBe(100);
      expect(response.pod?.y).toBe(100);
      expect(response.pod?.rotation).toBe(0);
      expect(response.pod?.workspacePath).toBeDefined();
      expect(response.pod?.gitUrl).toBeNull();
      expect(response.pod?.createdAt).toBeDefined();
      expect(response.pod?.lastActiveAt).toBeDefined();
      expect(response.pod?.output).toEqual([]);
      expect(response.pod?.outputStyleId).toBeNull();
      expect(response.pod?.skillIds).toEqual([]);
      expect(response.pod?.subAgentIds).toEqual([]);
      expect(response.pod?.model).toBeDefined();
      expect(response.pod?.repositoryId).toBeNull();
    });

    it('應能取得 Pod 列表', async () => {
      // 先建立 2 個 Pod
      const pod1Payload = createTestPodPayload({ name: 'Pod 1' });
      const pod2Payload = createTestPodPayload({ name: 'Pod 2' });

      await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        pod1Payload
      );

      await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        pod2Payload
      );

      // 取得 Pod 列表
      const listPayload: PodListPayload = { requestId: uuidv4() };
      const listResponse = await emitAndWaitResponse<PodListPayload, PodListResultPayload>(
        client,
        WebSocketRequestEvents.POD_LIST,
        WebSocketResponseEvents.POD_LIST_RESULT,
        listPayload
      );

      expect(listResponse.success).toBe(true);
      expect(listResponse.pods).toBeDefined();
      expect(listResponse.pods?.length).toBeGreaterThanOrEqual(2);

      const podNames = listResponse.pods?.map((p) => p.name);
      expect(podNames).toContain('Pod 1');
      expect(podNames).toContain('Pod 2');
    });

    it('應能取得單一 Pod', async () => {
      // 先建立 1 個 Pod
      const createPayload = createTestPodPayload({ name: 'Single Pod' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      expect(createResponse.pod?.id).toBeDefined();
      const podId = createResponse.pod!.id;

      // 取得單一 Pod
      const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
      const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
        client,
        WebSocketRequestEvents.POD_GET,
        WebSocketResponseEvents.POD_GET_RESULT,
        getPayload
      );

      expect(getResponse.success).toBe(true);
      expect(getResponse.pod).toBeDefined();
      expect(getResponse.pod?.id).toBe(podId);
      expect(getResponse.pod?.name).toBe('Single Pod');
    });

    it('應能更新 Pod 位置和名稱', async () => {
      // 先建立 1 個 Pod
      const createPayload = createTestPodPayload({ name: 'Old Name', x: 50, y: 50 });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      // 更新 Pod
      const updatePayload: PodUpdatePayload = {
        requestId: uuidv4(),
        podId,
        x: 100,
        y: 200,
        name: '新名稱',
      };

      const updateResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.pod).toBeDefined();
      expect(updateResponse.pod?.x).toBe(100);
      expect(updateResponse.pod?.y).toBe(200);
      expect(updateResponse.pod?.name).toBe('新名稱');
    });

    it('應能更新 Pod Model', async () => {
      // 先建立 1 個 Pod（預設 model: 'opus'）
      const createPayload = createTestPodPayload();
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;
      const originalModel = createResponse.pod!.model;

      // 更新 Model
      const updatePayload: PodUpdatePayload = {
        requestId: uuidv4(),
        podId,
        model: 'sonnet',
      };

      const updateResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.pod).toBeDefined();
      expect(updateResponse.pod?.model).toBe('sonnet');
      expect(updateResponse.pod?.model).not.toBe(originalModel);
    });

    it('應能刪除 Pod', async () => {
      // 先建立 1 個 Pod
      const createPayload = createTestPodPayload({ name: 'To Be Deleted' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      // 確保 Pod 建立成功
      expect(createResponse.success).toBe(true);
      expect(createResponse.pod).toBeDefined();

      const podId = createResponse.pod!.id;

      // 刪除 Pod
      const deletePayload: PodDeletePayload = { requestId: uuidv4(), podId };
      const deleteResponse = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        deletePayload
      );

      // 如果失敗，輸出詳細錯誤資訊
      if (!deleteResponse.success) {
        console.error('Delete failed:', JSON.stringify(deleteResponse, null, 2));
      }

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.podId).toBe(podId);

      // 驗證 Pod 已不存在
      const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
      const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
        client,
        WebSocketRequestEvents.POD_GET,
        WebSocketResponseEvents.POD_GET_RESULT,
        getPayload
      );

      expect(getResponse.success).toBe(false);
      expect(getResponse.error).toBeDefined();
    });
  });

  describe('Pod Room 管理', () => {
    it('應能加入 Pod Room', async () => {
      // 先建立 1 個 Pod
      const createPayload = createTestPodPayload({ name: 'Pod for Room' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      // 加入 Pod Room
      const joinPayload: PodJoinPayload = { podId };
      const joinResponse = await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        joinPayload
      );

      expect(joinResponse).toBeDefined();
      expect(joinResponse.podId).toBe(podId);
    });

    it('應能批次加入多個 Pod Room', async () => {
      // 先建立 3 個 Pod
      const pod1 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Batch Pod 1' })
      );

      const pod2 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Batch Pod 2' })
      );

      const pod3 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Batch Pod 3' })
      );

      const podIds = [pod1.pod!.id, pod2.pod!.id, pod3.pod!.id];

      // 批次加入 Pod Room
      const joinBatchPayload: PodJoinBatchPayload = { podIds };
      const joinBatchResponse = await emitAndWaitResponse<PodJoinBatchPayload, PodJoinedBatchPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN_BATCH,
        WebSocketResponseEvents.POD_JOINED_BATCH,
        joinBatchPayload
      );

      expect(joinBatchResponse).toBeDefined();
      expect(joinBatchResponse.joinedPodIds).toHaveLength(3);
      expect(joinBatchResponse.joinedPodIds).toEqual(expect.arrayContaining(podIds));
      expect(joinBatchResponse.failedPodIds).toHaveLength(0);
    });

    it('批次加入時應處理無效的 podId', async () => {
      // 先建立 2 個 Pod
      const pod1 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Valid Pod 1' })
      );

      const pod2 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Valid Pod 2' })
      );

      const validId1 = pod1.pod!.id;
      const validId2 = pod2.pod!.id;
      const invalidId = ''; // 空字串會被視為無效

      // 批次加入（包含無效 ID）
      const joinBatchPayload: PodJoinBatchPayload = { podIds: [validId1, validId2, invalidId] };
      const joinBatchResponse = await emitAndWaitResponse<PodJoinBatchPayload, PodJoinedBatchPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN_BATCH,
        WebSocketResponseEvents.POD_JOINED_BATCH,
        joinBatchPayload
      );

      expect(joinBatchResponse).toBeDefined();
      expect(joinBatchResponse.joinedPodIds).toHaveLength(2);
      expect(joinBatchResponse.joinedPodIds).toContain(validId1);
      expect(joinBatchResponse.joinedPodIds).toContain(validId2);
      expect(joinBatchResponse.failedPodIds).toHaveLength(1);
      expect(joinBatchResponse.failedPodIds).toContain(invalidId);
    });

    it('應能離開 Pod Room', async () => {
      // 先建立並加入 1 個 Pod
      const createPayload = createTestPodPayload({ name: 'Pod for Leave' });
      const createResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createPayload
      );

      const podId = createResponse.pod!.id;

      // 先加入
      await emitAndWaitResponse<PodJoinPayload, PodJoinedPayload>(
        client,
        WebSocketRequestEvents.POD_JOIN,
        WebSocketResponseEvents.POD_JOINED,
        { podId }
      );

      // 離開 Pod Room
      const leavePayload: PodLeavePayload = { podId };
      const leaveResponse = await emitAndWaitResponse<PodLeavePayload, PodLeftPayload>(
        client,
        WebSocketRequestEvents.POD_LEAVE,
        WebSocketResponseEvents.POD_LEFT,
        leavePayload
      );

      expect(leaveResponse).toBeDefined();
      expect(leaveResponse.podId).toBe(podId);
    });
  });

  describe('Pod 錯誤處理', () => {
    it('取得不存在的 Pod 應回傳錯誤', async () => {
      const nonExistentPodId = '00000000-0000-0000-0000-000000000000';
      const getPayload: PodGetPayload = { requestId: uuidv4(), podId: nonExistentPodId };

      const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
        client,
        WebSocketRequestEvents.POD_GET,
        WebSocketResponseEvents.POD_GET_RESULT,
        getPayload
      );

      expect(getResponse.success).toBe(false);
      expect(getResponse.error).toBeDefined();
      expect(getResponse.error).toContain('not found');
    });

    it('更新不存在的 Pod 應回傳錯誤', async () => {
      const nonExistentPodId = '00000000-0000-0000-0000-000000000000';
      const updatePayload: PodUpdatePayload = {
        requestId: uuidv4(),
        podId: nonExistentPodId,
        name: 'Should Fail',
      };

      const updateResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(false);
      expect(updateResponse.error).toBeDefined();
      expect(updateResponse.error).toContain('not found');
    });

    it('刪除不存在的 Pod 應回傳錯誤', async () => {
      const nonExistentPodId = '00000000-0000-0000-0000-000000000000';
      const deletePayload: PodDeletePayload = {
        requestId: uuidv4(),
        podId: nonExistentPodId,
      };

      const deleteResponse = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('not found');
    });
  });
});
