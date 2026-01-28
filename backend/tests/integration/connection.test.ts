// Phase 3: Connection 管理 Flow 測試
// 測試 Connection 的完整生命週期、錯誤處理和與 Pod 的關聯

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
import { createTestPodPayload, createTestConnectionPayload } from '../fixtures/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodDeletePayload,
  type PodDeletedPayload,
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type ConnectionListPayload,
  type ConnectionListResultPayload,
  type ConnectionUpdatePayload,
  type ConnectionUpdatedPayload,
  type ConnectionDeletePayload,
  type ConnectionDeletedPayload,
} from '../../src/types/index.js';

describe('Phase 3: Connection 管理 Flow', () => {
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

  describe('Connection 完整生命週期', () => {
    it('應能建立兩個 Pod 之間的 Connection', async () => {
      // 建立 2 個 Pod
      const pod1Response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Source Pod' })
      );

      const pod2Response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Target Pod' })
      );

      expect(pod1Response.success).toBe(true);
      expect(pod2Response.success).toBe(true);

      const sourcePodId = pod1Response.pod!.id;
      const targetPodId = pod2Response.pod!.id;

      // 建立 Connection
      const connectionPayload: ConnectionCreatePayload = createTestConnectionPayload(
        sourcePodId,
        targetPodId,
        {
          sourceAnchor: 'bottom',
          targetAnchor: 'top',
        }
      );

      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(true);
      expect(connectionResponse.connection).toBeDefined();
      expect(connectionResponse.connection?.id).toBeDefined();
      expect(connectionResponse.connection?.sourcePodId).toBe(sourcePodId);
      expect(connectionResponse.connection?.targetPodId).toBe(targetPodId);
      expect(connectionResponse.connection?.sourceAnchor).toBe('bottom');
      expect(connectionResponse.connection?.targetAnchor).toBe('top');
      expect(connectionResponse.connection?.autoTrigger).toBe(true); // 預設為 true
      expect(connectionResponse.connection?.createdAt).toBeDefined();
    });

    it('應能取得 Connection 列表', async () => {
      // 建立 2 個 Pod
      const pod1 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod A' })
      );

      const pod2 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod B' })
      );

      const sourcePodId = pod1.pod!.id;
      const targetPodId = pod2.pod!.id;

      // 建立 1 個 Connection
      const connectionPayload = createTestConnectionPayload(sourcePodId, targetPodId);
      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(true);
      const createdConnectionId = connectionResponse.connection!.id;

      // 取得 Connection 列表
      const listPayload: ConnectionListPayload = { requestId: uuidv4() };
      const listResponse = await emitAndWaitResponse<
        ConnectionListPayload,
        ConnectionListResultPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        listPayload
      );

      expect(listResponse.success).toBe(true);
      expect(listResponse.connections).toBeDefined();
      expect(listResponse.connections!.length).toBeGreaterThanOrEqual(1);

      // 驗證剛建立的 Connection 在列表中
      const foundConnection = listResponse.connections!.find((c) => c.id === createdConnectionId);
      expect(foundConnection).toBeDefined();
      expect(foundConnection?.sourcePodId).toBe(sourcePodId);
      expect(foundConnection?.targetPodId).toBe(targetPodId);
    });

    it('應能更新 Connection 的 autoTrigger 設定', async () => {
      // 建立 2 個 Pod 和 1 個 Connection
      const pod1 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod 1' })
      );

      const pod2 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod 2' })
      );

      const connectionPayload = createTestConnectionPayload(pod1.pod!.id, pod2.pod!.id);
      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(true);
      expect(connectionResponse.connection?.autoTrigger).toBe(true); // 預設為 true

      const connectionId = connectionResponse.connection!.id;

      // 更新 Connection 的 autoTrigger 為 false
      const updatePayload: ConnectionUpdatePayload = {
        requestId: uuidv4(),
        connectionId,
        autoTrigger: false,
      };

      const updateResponse = await emitAndWaitResponse<
        ConnectionUpdatePayload,
        ConnectionUpdatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.connection).toBeDefined();
      expect(updateResponse.connection?.id).toBe(connectionId);
      expect(updateResponse.connection?.autoTrigger).toBe(false);
    });

    it('應能刪除 Connection', async () => {
      // 建立 2 個 Pod 和 1 個 Connection
      const pod1 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod X' })
      );

      const pod2 = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod Y' })
      );

      const connectionPayload = createTestConnectionPayload(pod1.pod!.id, pod2.pod!.id);
      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(true);
      const connectionId = connectionResponse.connection!.id;

      // 刪除 Connection
      const deletePayload: ConnectionDeletePayload = {
        requestId: uuidv4(),
        connectionId,
      };

      const deleteResponse = await emitAndWaitResponse<
        ConnectionDeletePayload,
        ConnectionDeletedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_DELETE,
        WebSocketResponseEvents.CONNECTION_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.connectionId).toBe(connectionId);

      // 驗證 Connection 已不存在（透過列表查詢）
      const listPayload: ConnectionListPayload = { requestId: uuidv4() };
      const listResponse = await emitAndWaitResponse<
        ConnectionListPayload,
        ConnectionListResultPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        listPayload
      );

      expect(listResponse.success).toBe(true);
      const deletedConnection = listResponse.connections!.find((c) => c.id === connectionId);
      expect(deletedConnection).toBeUndefined();
    });
  });

  describe('Connection 錯誤處理', () => {
    it('建立 Connection 時來源 Pod 不存在應回傳錯誤', async () => {
      // 只建立 1 個 Pod（目標 Pod）
      const targetPod = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Target Pod' })
      );

      expect(targetPod.success).toBe(true);

      // 使用不存在的來源 Pod ID
      const nonExistentSourceId = '00000000-0000-0000-0000-000000000000';
      const connectionPayload = createTestConnectionPayload(
        nonExistentSourceId,
        targetPod.pod!.id
      );

      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(false);
      expect(connectionResponse.error).toBeDefined();
      expect(connectionResponse.error).toContain('not found');
    });

    it('建立 Connection 時目標 Pod 不存在應回傳錯誤', async () => {
      // 只建立 1 個 Pod（來源 Pod）
      const sourcePod = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Source Pod' })
      );

      expect(sourcePod.success).toBe(true);

      // 使用不存在的目標 Pod ID
      const nonExistentTargetId = '00000000-0000-0000-0000-000000000000';
      const connectionPayload = createTestConnectionPayload(
        sourcePod.pod!.id,
        nonExistentTargetId
      );

      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      expect(connectionResponse.success).toBe(false);
      expect(connectionResponse.error).toBeDefined();
      expect(connectionResponse.error).toContain('not found');
    });

    it('刪除不存在的 Connection 應回傳錯誤', async () => {
      const nonExistentConnectionId = '00000000-0000-0000-0000-000000000000';
      const deletePayload: ConnectionDeletePayload = {
        requestId: uuidv4(),
        connectionId: nonExistentConnectionId,
      };

      const deleteResponse = await emitAndWaitResponse<
        ConnectionDeletePayload,
        ConnectionDeletedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_DELETE,
        WebSocketResponseEvents.CONNECTION_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('not found');
    });
  });

  describe('刪除 Pod 時連帶刪除 Connection', () => {
    it('刪除 Pod 應同時刪除相關的 Connection', async () => {
      // 建立 3 個 Pod（A, B, C）
      const podA = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod A' })
      );

      const podB = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod B' })
      );

      const podC = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        createTestPodPayload({ name: 'Pod C' })
      );

      expect(podA.success).toBe(true);
      expect(podB.success).toBe(true);
      expect(podC.success).toBe(true);

      const podAId = podA.pod!.id;
      const podBId = podB.pod!.id;
      const podCId = podC.pod!.id;

      // 建立 2 個 Connection（A->B, B->C）
      const connectionAB = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podAId, podBId)
      );

      const connectionBC = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        createTestConnectionPayload(podBId, podCId)
      );

      expect(connectionAB.success).toBe(true);
      expect(connectionBC.success).toBe(true);

      const connectionABId = connectionAB.connection!.id;
      const connectionBCId = connectionBC.connection!.id;

      // 刪除 Pod B
      const deletePodPayload: PodDeletePayload = {
        requestId: uuidv4(),
        podId: podBId,
      };

      const deletePodResponse = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        deletePodPayload
      );

      expect(deletePodResponse.success).toBe(true);

      // 驗證兩個 Connection 都已被刪除
      const listPayload: ConnectionListPayload = { requestId: uuidv4() };
      const listResponse = await emitAndWaitResponse<
        ConnectionListPayload,
        ConnectionListResultPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        listPayload
      );

      expect(listResponse.success).toBe(true);

      const foundConnectionAB = listResponse.connections!.find((c) => c.id === connectionABId);
      const foundConnectionBC = listResponse.connections!.find((c) => c.id === connectionBCId);

      expect(foundConnectionAB).toBeUndefined();
      expect(foundConnectionBC).toBeUndefined();
    });
  });
});
