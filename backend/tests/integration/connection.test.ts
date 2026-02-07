import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup';
import { createPod, createPodPair, setPodSchedule, FAKE_UUID, getCanvasId} from '../helpers';
import { createConnection } from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
  type ConnectionListPayload,
  type ConnectionDeletePayload,
  type ConnectionUpdatePayload,
} from '../../src/schemas';
import {
  type ConnectionCreatedPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletedPayload,
  type ConnectionUpdatedPayload,
} from '../../src/types';

describe('Connection 管理', () => {
  let server: TestServerInstance;
  let client: TestWebSocketClient;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('Connection 建立', () => {
    it('success_when_connection_created_between_two_pods', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      expect(conn.id).toBeDefined();
      expect(conn.sourcePodId).toBe(podA.id);
      expect(conn.targetPodId).toBe(podB.id);
      expect(conn.sourceAnchor).toBe('right');
      expect(conn.targetAnchor).toBe('left');
    });

    it('success_when_connection_created_and_target_pod_has_no_schedule', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      expect(conn.id).toBeDefined();
      expect(conn.sourcePodId).toBe(podA.id);
      expect(conn.targetPodId).toBe(podB.id);
    });

    it('success_when_connection_created_clears_target_pod_schedule', async () => {
      const { podA, podB } = await createPodPair(client);

      const scheduleConfig = {
        frequency: 'every-day' as const,
        second: 0,
        intervalMinute: 1,
        intervalHour: 1,
        hour: 9,
        minute: 0,
        weekdays: [1, 2, 3, 4, 5],
        enabled: true,
      };

      const updatedPodB = await setPodSchedule(client, podB.id, scheduleConfig);
      expect(updatedPodB.schedule).toBeDefined();
      expect(updatedPodB.schedule?.enabled).toBe(true);

      const conn = await createConnection(client, podA.id, podB.id);
      expect(conn.id).toBeDefined();

      const canvasModule = await import('../../src/services/podStore.js');
      const podAfterConnection = canvasModule.podStore.getById(await getCanvasId(client), podB.id);
      expect(podAfterConnection?.schedule).toBeUndefined();
    });

    it('failed_when_connection_create_with_nonexistent_source_pod', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        { requestId: uuidv4(), canvasId, sourcePodId: FAKE_UUID, sourceAnchor: 'right', targetPodId: pod.id, targetAnchor: 'left' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_connection_create_with_nonexistent_target_pod', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        { requestId: uuidv4(), canvasId, sourcePodId: pod.id, sourceAnchor: 'right', targetPodId: FAKE_UUID, targetAnchor: 'left' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Connection 列表', () => {
    it('success_when_connection_list_returns_all_connections', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionListPayload, ConnectionListResultPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const found = response.connections!.find((c) => c.id === conn.id);
      expect(found).toBeDefined();
    });

    it('success_when_connection_list_returns_array', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionListPayload, ConnectionListResultPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(Array.isArray(response.connections)).toBe(true);
    });
  });

  describe('Connection 刪除', () => {
    it('success_when_connection_deleted', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionDeletePayload, ConnectionDeletedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_DELETE,
        WebSocketResponseEvents.CONNECTION_DELETED,
        { requestId: uuidv4(), canvasId, connectionId: conn.id }
      );

      expect(response.success).toBe(true);
      expect(response.connectionId).toBe(conn.id);
    });

    it('failed_when_connection_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionDeletePayload, ConnectionDeletedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_DELETE,
        WebSocketResponseEvents.CONNECTION_DELETED,
        { requestId: uuidv4(), canvasId, connectionId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Connection 更新', () => {
    it('success_when_connection_updated_with_trigger_mode', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        { requestId: uuidv4(), canvasId, connectionId: conn.id, triggerMode: 'ai-decide' }
      );

      expect(response.success).toBe(true);
      expect(response.connection!.triggerMode).toBe('ai-decide');
    });

    it('success_when_connection_updated_with_trigger_mode_direct', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        { requestId: uuidv4(), canvasId, connectionId: conn.id, triggerMode: 'direct' }
      );

      expect(response.success).toBe(true);
      expect(response.connection!.triggerMode).toBe('direct');
    });

    it('failed_when_connection_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        { requestId: uuidv4(), canvasId, connectionId: FAKE_UUID, triggerMode: 'auto' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
