import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  disconnectSocket,
  emitAndWaitResponse,
  type TestServerInstance,
} from '../setup/index.js';
import {
  createTrigger,
  createTriggerConnection,
  listTriggers,
  createPod,
  getCanvasId,
  FAKE_UUID,
} from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type TriggerUpdatePayload,
  type TriggerDeletePayload,
  type ConnectionListPayload,
} from '../../src/schemas/index.js';
import {
  type TriggerUpdatedPayload,
  type TriggerDeletedPayload,
  type ConnectionListResultPayload,
  type TimeTriggerConfig,
} from '../../src/types/index.js';

describe('Trigger 管理', () => {
  let server: TestServerInstance;
  let client: Socket;
  let canvasId: string;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
    canvasId = await getCanvasId(client);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('Trigger 建立', () => {
    it('success_when_trigger_created_with_valid_payload', async () => {
      const trigger = await createTrigger(client, {
        name: 'Created Trigger',
        type: 'time',
        x: 100,
        y: 200,
        rotation: 5,
        enabled: true,
      });

      expect(trigger.id).toBeDefined();
      expect(trigger.name).toBe('Created Trigger');
      expect(trigger.type).toBe('time');
      expect(trigger.x).toBe(100);
      expect(trigger.y).toBe(200);
      expect(trigger.rotation).toBe(5);
      expect(trigger.enabled).toBe(true);
      expect(trigger.config).toBeDefined();
      expect(trigger.createdAt).toBeDefined();
    });
  });

  describe('Trigger 列表', () => {
    it('success_when_trigger_list_returns_all_triggers', async () => {
      await createTrigger(client, { name: 'List Trigger 1' });
      await createTrigger(client, { name: 'List Trigger 2' });

      const triggers = await listTriggers(client);

      expect(Array.isArray(triggers)).toBe(true);
      const names = triggers.map((t) => t.name);
      expect(names).toContain('List Trigger 1');
      expect(names).toContain('List Trigger 2');
    });
  });

  describe('Trigger 更新', () => {
    it('success_when_trigger_updated_with_name', async () => {
      const trigger = await createTrigger(client, { name: 'Original Name' });

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, name: 'Updated Name' }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.name).toBe('Updated Name');
      expect(response.trigger!.x).toBe(trigger.x);
      expect(response.trigger!.y).toBe(trigger.y);
    });

    it('success_when_trigger_updated_with_type', async () => {
      const trigger = await createTrigger(client);

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, type: 'time' }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.type).toBe('time');
    });

    it('success_when_trigger_updated_with_config', async () => {
      const trigger = await createTrigger(client);

      const newConfig: TimeTriggerConfig = {
        frequency: 'every-x-minute',
        second: 30,
        intervalMinute: 5,
        intervalHour: 2,
        hour: 10,
        minute: 30,
        weekdays: [1, 3, 5],
      };

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, config: newConfig }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.config).toEqual(newConfig);
    });

    it('success_when_trigger_updated_with_position', async () => {
      const trigger = await createTrigger(client, { x: 10, y: 20 });

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, x: 500, y: 600 }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.x).toBe(500);
      expect(response.trigger!.y).toBe(600);
    });

    it('success_when_trigger_updated_with_rotation', async () => {
      const trigger = await createTrigger(client, { rotation: 0 });

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, rotation: 45 }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.rotation).toBe(45);
    });

    it('success_when_trigger_updated_with_enabled', async () => {
      const trigger = await createTrigger(client, { enabled: true });

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, enabled: false }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.enabled).toBe(false);
    });

    it('success_when_trigger_updated_with_partial_fields', async () => {
      const trigger = await createTrigger(client, { name: 'Original', x: 10, y: 20, rotation: 0 });

      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id, x: 99 }
      );

      expect(response.success).toBe(true);
      expect(response.trigger!.x).toBe(99);
      expect(response.trigger!.y).toBe(20);
      expect(response.trigger!.name).toBe('Original');
      expect(response.trigger!.rotation).toBe(0);
    });

    it('failed_when_trigger_update_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_UPDATE,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        { requestId: uuidv4(), canvasId, triggerId: FAKE_UUID, name: 'Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Trigger 刪除', () => {
    it('success_when_trigger_deleted', async () => {
      const trigger = await createTrigger(client, { name: 'To Delete' });

      const response = await emitAndWaitResponse<TriggerDeletePayload, TriggerDeletedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_DELETE,
        WebSocketResponseEvents.TRIGGER_DELETED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id }
      );

      expect(response.success).toBe(true);
      expect(response.triggerId).toBe(trigger.id);
    });

    it('success_when_trigger_delete_also_deletes_connections', async () => {
      const trigger = await createTrigger(client, { name: 'Trigger with Connection' });
      const pod = await createPod(client, { name: 'Target Pod' });

      await createTriggerConnection(client, trigger.id, pod.id);

      const response = await emitAndWaitResponse<TriggerDeletePayload, TriggerDeletedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_DELETE,
        WebSocketResponseEvents.TRIGGER_DELETED,
        { requestId: uuidv4(), canvasId, triggerId: trigger.id }
      );

      expect(response.success).toBe(true);
      expect(response.triggerId).toBe(trigger.id);

      const listResponse = await emitAndWaitResponse<ConnectionListPayload, ConnectionListResultPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_LIST,
        WebSocketResponseEvents.CONNECTION_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      const related = listResponse.connections!.filter(
        (c) => c.sourceTriggerId === trigger.id
      );
      expect(related).toHaveLength(0);
    });

    it('failed_when_trigger_delete_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<TriggerDeletePayload, TriggerDeletedPayload>(
        client,
        WebSocketRequestEvents.TRIGGER_DELETE,
        WebSocketResponseEvents.TRIGGER_DELETED,
        { requestId: uuidv4(), canvasId, triggerId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
