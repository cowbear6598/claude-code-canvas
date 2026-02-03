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
  createCanvas,
  getCanvasId,
} from '../helpers/index.js';
import { FAKE_UUID } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type CanvasCreatePayload,
  type CanvasListPayload,
  type CanvasRenamePayload,
  type CanvasDeletePayload,
  type CanvasSwitchPayload,
} from '../../src/schemas/index.js';
import {
  type CanvasCreatedPayload,
  type CanvasListResultPayload,
  type CanvasRenamedPayload,
  type CanvasDeletedPayload,
  type CanvasSwitchedPayload,
} from '../../src/types/index.js';

describe('Canvas 管理', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  }, 30000);

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('Canvas 建立', () => {
    it('success_when_canvas_created_with_valid_name', async () => {
      const canvas = await createCanvas(client, 'Test Canvas');

      expect(canvas.id).toBeDefined();
      expect(canvas.name).toBe('Test Canvas');
      expect(canvas.createdAt).toBeDefined();
    });

    it('failed_when_canvas_create_with_empty_name', async () => {
      const response = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_CREATE,
        WebSocketResponseEvents.CANVAS_CREATED,
        { requestId: uuidv4(), name: '' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('failed_when_canvas_create_with_invalid_name', async () => {
      const response = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_CREATE,
        WebSocketResponseEvents.CANVAS_CREATED,
        { requestId: uuidv4(), name: 'Invalid@Name!' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Canvas 列表', () => {
    it('success_when_canvas_list_returns_all_canvases', async () => {
      await createCanvas(client, 'List Canvas 1');
      await createCanvas(client, 'List Canvas 2');

      const response = await emitAndWaitResponse<CanvasListPayload, CanvasListResultPayload>(
        client,
        WebSocketRequestEvents.CANVAS_LIST,
        WebSocketResponseEvents.CANVAS_LIST_RESULT,
        { requestId: uuidv4() }
      );

      expect(response.success).toBe(true);
      const names = response.canvases!.map((c) => c.name);
      expect(names).toContain('List Canvas 1');
      expect(names).toContain('List Canvas 2');
    });

    it('success_when_canvas_list_returns_array', async () => {
      const response = await emitAndWaitResponse<CanvasListPayload, CanvasListResultPayload>(
        client,
        WebSocketRequestEvents.CANVAS_LIST,
        WebSocketResponseEvents.CANVAS_LIST_RESULT,
        { requestId: uuidv4() }
      );

      expect(response.success).toBe(true);
      expect(Array.isArray(response.canvases)).toBe(true);
    });
  });

  describe('Canvas 重命名', () => {
    it('success_when_canvas_renamed', async () => {
      const canvas = await createCanvas(client, 'Original Name');

      const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_RENAME,
        WebSocketResponseEvents.CANVAS_RENAMED,
        { requestId: uuidv4(), canvasId: canvas.id, newName: 'Renamed Canvas' }
      );

      expect(response.success).toBe(true);
      expect(response.canvas!.id).toBe(canvas.id);
      expect(response.canvas!.name).toBe('Renamed Canvas');
    });

    it('failed_when_canvas_rename_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_RENAME,
        WebSocketResponseEvents.CANVAS_RENAMED,
        { requestId: uuidv4(), canvasId: FAKE_UUID, newName: 'New Name' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_canvas_rename_with_empty_name', async () => {
      const canvas = await createCanvas(client, 'Valid Name');

      const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_RENAME,
        WebSocketResponseEvents.CANVAS_RENAMED,
        { requestId: uuidv4(), canvasId: canvas.id, newName: '' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('failed_when_canvas_rename_with_invalid_name', async () => {
      const createResponse = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_CREATE,
        WebSocketResponseEvents.CANVAS_CREATED,
        { requestId: uuidv4(), name: 'Valid_Name_2' }
      );

      expect(createResponse.success).toBe(true);
      const canvas = createResponse.canvas!;

      const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_RENAME,
        WebSocketResponseEvents.CANVAS_RENAMED,
        { requestId: uuidv4(), canvasId: canvas.id, newName: 'Invalid@Name!' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Canvas 刪除', () => {
    it('success_when_canvas_deleted', async () => {
      const canvas = await createCanvas(client, 'To Delete');

      const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_DELETE,
        WebSocketResponseEvents.CANVAS_DELETED,
        { requestId: uuidv4(), canvasId: canvas.id }
      );

      expect(response.success).toBe(true);
      expect(response.canvasId).toBe(canvas.id);
    });

    it('failed_when_canvas_delete_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_DELETE,
        WebSocketResponseEvents.CANVAS_DELETED,
        { requestId: uuidv4(), canvasId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_canvas_delete_while_in_use', async () => {
      const activeCanvasId = await getCanvasId(client);

      const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_DELETE,
        WebSocketResponseEvents.CANVAS_DELETED,
        { requestId: uuidv4(), canvasId: activeCanvasId }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('無法刪除正在使用的 Canvas');
    });
  });

  describe('Canvas 切換', () => {
    it('success_when_canvas_switched', async () => {
      const canvas = await createCanvas(client, 'Switch Target');

      const response = await emitAndWaitResponse<CanvasSwitchPayload, CanvasSwitchedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_SWITCH,
        WebSocketResponseEvents.CANVAS_SWITCHED,
        { requestId: uuidv4(), canvasId: canvas.id }
      );

      expect(response.success).toBe(true);
      expect(response.canvasId).toBe(canvas.id);
    });

    it('failed_when_canvas_switch_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<CanvasSwitchPayload, CanvasSwitchedPayload>(
        client,
        WebSocketRequestEvents.CANVAS_SWITCH,
        WebSocketResponseEvents.CANVAS_SWITCHED,
        { requestId: uuidv4(), canvasId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
