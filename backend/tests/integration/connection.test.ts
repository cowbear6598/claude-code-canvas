import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { createPod, createPodPair, FAKE_UUID, getCanvasId} from '../helpers/index.js';
import { createConnection } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
  type ConnectionListPayload,
  type ConnectionDeletePayload,
  type ConnectionUpdatePayload,
} from '../../src/schemas/index.js';
import {
  type ConnectionCreatedPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletedPayload,
  type ConnectionUpdatedPayload,
} from '../../src/types/index.js';

describe('connection', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('handleConnectionCreate', () => {
    it('success_when_connection_created_between_two_pods', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      expect(conn.id).toBeDefined();
      expect(conn.sourcePodId).toBe(podA.id);
      expect(conn.targetPodId).toBe(podB.id);
      expect(conn.sourceAnchor).toBe('right');
      expect(conn.targetAnchor).toBe('left');
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

  describe('handleConnectionList', () => {
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

  describe('handleConnectionDelete', () => {
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

  describe('handleConnectionUpdate', () => {
    it('success_when_connection_updated_with_auto_trigger', async () => {
      const { podA, podB } = await createPodPair(client);
      const conn = await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        { requestId: uuidv4(), canvasId, connectionId: conn.id, autoTrigger: false }
      );

      expect(response.success).toBe(true);
      expect(response.connection!.autoTrigger).toBe(false);
    });

    it('failed_when_connection_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_UPDATE,
        WebSocketResponseEvents.CONNECTION_UPDATED,
        { requestId: uuidv4(), canvasId, connectionId: FAKE_UUID, autoTrigger: true }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
