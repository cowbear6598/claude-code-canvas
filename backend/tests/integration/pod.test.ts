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
import { createOutputStyle } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodListPayload,
  type PodGetPayload,
  type PodUpdatePayload,
  type PodDeletePayload,
  type ConnectionListPayload,
  type NoteCreatePayload,
  type NoteListPayload,
} from '../../src/schemas/index.js';
import {
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodUpdatedPayload,
  type PodDeletedPayload,
  type ConnectionListResultPayload,
  type NoteCreatedPayload,
  type NoteListResultPayload,
} from '../../src/types/index.js';

describe('Pod 管理', () => {
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

  describe('Pod 建立', () => {
    it('success_when_pod_created_with_valid_payload', async () => {
      const pod = await createPod(client, {
        name: 'Created Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 5,
      });

      expect(pod.id).toBeDefined();
      expect(pod.name).toBe('Created Pod');
      expect(pod.color).toBe('blue');
      expect(pod.x).toBe(100);
      expect(pod.y).toBe(200);
      expect(pod.rotation).toBe(5);
      expect(pod.workspacePath).toBeDefined();
      expect(pod.createdAt).toBeDefined();
      expect(pod.lastActiveAt).toBeDefined();
      expect(pod.output).toEqual([]);
      expect(pod.skillIds).toEqual([]);
      expect(pod.subAgentIds).toEqual([]);
    });

    it('success_when_pod_created_has_default_status_idle', async () => {
      const pod = await createPod(client);
      expect(pod.status).toBe('idle');
    });
  });

  describe('Pod 列表', () => {
    it('success_when_pod_list_returns_all_pods', async () => {
      await createPod(client, { name: 'List Pod 1' });
      await createPod(client, { name: 'List Pod 2' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodListPayload, PodListResultPayload>(
        client,
        WebSocketRequestEvents.POD_LIST,
        WebSocketResponseEvents.POD_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const names = response.pods!.map((p) => p.name);
      expect(names).toContain('List Pod 1');
      expect(names).toContain('List Pod 2');
    });

    it('success_when_pod_list_returns_array', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodListPayload, PodListResultPayload>(
        client,
        WebSocketRequestEvents.POD_LIST,
        WebSocketResponseEvents.POD_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(Array.isArray(response.pods)).toBe(true);
    });
  });

  describe('Pod 取得', () => {
    it('success_when_pod_get_returns_existing_pod', async () => {
      const pod = await createPod(client, { name: 'Get Pod' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
        client,
        WebSocketRequestEvents.POD_GET,
        WebSocketResponseEvents.POD_GET_RESULT,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.id).toBe(pod.id);
      expect(response.pod!.name).toBe('Get Pod');
    });

    it('failed_when_pod_get_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
        client,
        WebSocketRequestEvents.POD_GET,
        WebSocketResponseEvents.POD_GET_RESULT,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Pod 更新', () => {
    it('success_when_pod_updated_with_position', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: pod.id, x: 500, y: 600 }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.x).toBe(500);
      expect(response.pod!.y).toBe(600);
    });

    it('success_when_pod_updated_with_name', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: pod.id, name: 'New Name' }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.name).toBe('New Name');
    });

    it('success_when_pod_updated_with_rotation', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: pod.id, rotation: 45 }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.rotation).toBe(45);
    });

    it('success_when_pod_updated_with_model', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: pod.id, model: 'sonnet' }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.model).toBe('sonnet');
    });

    it('success_when_pod_updated_with_partial_fields', async () => {
      const pod = await createPod(client, { name: 'Original', x: 10, y: 20 });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: pod.id, x: 99 }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.x).toBe(99);
      expect(response.pod!.y).toBe(20);
      expect(response.pod!.name).toBe('Original');
    });

    it('failed_when_pod_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, name: 'Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Pod 刪除', () => {
    it('success_when_pod_deleted', async () => {
      const pod = await createPod(client, { name: 'To Delete' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.podId).toBe(pod.id);
    });

    it('success_when_pod_delete_cleans_up_connections', async () => {
      const { podA, podB } = await createPodPair(client);
      await createConnection(client, podA.id, podB.id);

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        { requestId: uuidv4(), canvasId, podId: podA.id }
      );

      const listResponse = await emitAndWaitResponse<ConnectionListPayload, ConnectionListResultPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      const related = listResponse.connections!.filter(
        (c) => c.sourcePodId === podA.id || c.targetPodId === podA.id
      );
      expect(related).toHaveLength(0);
    });

    it('success_when_pod_delete_cleans_up_notes', async () => {
      const pod = await createPod(client);
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Test');

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          outputStyleId: style.id,
          name: 'Bound Note',
          x: 0,
          y: 0,
          boundToPodId: pod.id,
          originalPosition: null,
        }
      );

      await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      const listResponse = await emitAndWaitResponse<NoteListPayload, NoteListResultPayload>(
        client,
        WebSocketRequestEvents.NOTE_LIST,
        WebSocketResponseEvents.NOTE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      const bound = listResponse.notes!.filter((n) => n.boundToPodId === pod.id);
      expect(bound).toHaveLength(0);
    });

    it('failed_when_pod_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
        client,
        WebSocketRequestEvents.POD_DELETE,
        WebSocketResponseEvents.POD_DELETED,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
