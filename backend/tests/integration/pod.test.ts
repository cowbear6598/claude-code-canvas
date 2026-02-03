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

  describe('Pod Schedule 管理', () => {
    it('success_when_pod_created_with_schedule', async () => {
      const pod = await createPod(client, { name: 'Schedule Pod' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-day',
            second: 0,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 9,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.schedule).toBeDefined();
      expect(response.pod!.schedule!.frequency).toBe('every-day');
      expect(response.pod!.schedule!.enabled).toBe(true);
    });

    it('success_when_pod_updated_with_schedule', async () => {
      const pod = await createPod(client, { name: 'Update Schedule Pod' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-x-minute',
            second: 0,
            intervalMinute: 30,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.schedule).toBeDefined();
      expect(response.pod!.schedule!.frequency).toBe('every-x-minute');
      expect(response.pod!.schedule!.intervalMinute).toBe(30);
    });

    it('success_when_pod_schedule_enabled_toggled', async () => {
      const pod = await createPod(client, { name: 'Toggle Schedule Pod' });

      const canvasId = await getCanvasId(client);

      // 先設定 schedule
      await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-day',
            second: 0,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 10,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      // 停用 schedule
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-day',
            second: 0,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 10,
            minute: 0,
            weekdays: [],
            enabled: false,
          },
        }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.schedule!.enabled).toBe(false);
    });

    it('success_when_pod_schedule_removed', async () => {
      const pod = await createPod(client, { name: 'Remove Schedule Pod' });

      const canvasId = await getCanvasId(client);

      // 先設定 schedule
      await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-day',
            second: 0,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 11,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      // 清除 schedule (設為 null)
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: null,
        }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.schedule).toBeUndefined();
    });

    it('success_when_pod_schedule_enabled_has_lastTriggeredAt', async () => {
      const pod = await createPod(client, { name: 'Schedule with lastTriggeredAt' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-x-minute',
            second: 0,
            intervalMinute: 5,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.schedule).toBeDefined();
      expect(response.pod!.schedule!.enabled).toBe(true);
      expect(response.pod!.schedule!.lastTriggeredAt).toBeDefined();
    });

    it('success_when_pod_schedule_re_enabled_updates_lastTriggeredAt', async () => {
      const pod = await createPod(client, { name: 'Re-enable Schedule Pod' });

      const canvasId = await getCanvasId(client);

      // 先設定並啟用 schedule
      const firstResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-second',
            second: 10,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      const firstLastTriggeredAt = firstResponse.pod!.schedule!.lastTriggeredAt;
      expect(firstLastTriggeredAt).toBeDefined();

      // 停用 schedule
      const disableResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-second',
            second: 10,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: false,
          },
        }
      );

      // 停用時 lastTriggeredAt 應該保留
      expect(disableResponse.pod!.schedule!.lastTriggeredAt).toEqual(firstLastTriggeredAt);

      // 重新啟用 schedule
      const reEnableResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-second',
            second: 10,
            intervalMinute: 1,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      const secondLastTriggeredAt = reEnableResponse.pod!.schedule!.lastTriggeredAt;
      expect(secondLastTriggeredAt).toBeDefined();
      // 重新啟用時，lastTriggeredAt 應該被更新（不應該等於停用時保留的舊值）
      expect(secondLastTriggeredAt).not.toEqual(firstLastTriggeredAt);
    });

    it('success_when_pod_schedule_updated_preserves_lastTriggeredAt', async () => {
      const pod = await createPod(client, { name: 'Update Schedule Preserve lastTriggeredAt' });

      const canvasId = await getCanvasId(client);

      // 先設定並啟用 schedule
      const firstResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-x-minute',
            second: 0,
            intervalMinute: 10,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      const firstLastTriggeredAt = firstResponse.pod!.schedule!.lastTriggeredAt;

      // 更新 schedule 的 intervalMinute，但保持 enabled 為 true
      const updateResponse = await emitAndWaitResponse<PodUpdatePayload, PodUpdatedPayload>(
        client,
        WebSocketRequestEvents.POD_UPDATE,
        WebSocketResponseEvents.POD_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          podId: pod.id,
          schedule: {
            frequency: 'every-x-minute',
            second: 0,
            intervalMinute: 20,
            intervalHour: 1,
            hour: 0,
            minute: 0,
            weekdays: [],
            enabled: true,
          },
        }
      );

      expect(updateResponse.pod!.schedule!.intervalMinute).toBe(20);
      expect(updateResponse.pod!.schedule!.lastTriggeredAt).toEqual(firstLastTriggeredAt);
    });
  });
});
