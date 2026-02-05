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
import { createPod, createOutputStyle, FAKE_UUID, FAKE_STYLE_ID, getCanvasId} from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type OutputStyleCreatePayload,
  type OutputStyleListPayload,
  type OutputStyleReadPayload,
  type OutputStyleUpdatePayload,
  type OutputStyleDeletePayload,
  type PodBindOutputStylePayload,
  type PodUnbindOutputStylePayload,
} from '../../src/schemas';
import {
  type OutputStyleCreatedPayload,
  type OutputStyleListResultPayload,
  type OutputStyleReadResultPayload,
  type OutputStyleUpdatedPayload,
  type OutputStyleDeletedPayload,
  type PodOutputStyleBoundPayload,
  type PodOutputStyleUnboundPayload,
} from '../../src/types';

describe('OutputStyle 管理', () => {
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

  describe('OutputStyle 建立', () => {
    it('success_when_output_style_created', async () => {
      const name = `style-${uuidv4()}`;
      const style = await createOutputStyle(client, name, '# Style Content');

      expect(style.id).toBeDefined();
      expect(style.name).toBe(name);
    });

    it('failed_when_output_style_create_with_duplicate_name', async () => {
      const name = `dup-style-${uuidv4()}`;
      await createOutputStyle(client, name, '# First');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleCreatePayload, OutputStyleCreatedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_CREATE,
        WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
        { requestId: uuidv4(), canvasId, name, content: '# Second' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已存在');
    });
  });

  describe('OutputStyle 列表', () => {
    it('success_when_output_style_list_returns_all', async () => {
      const name1 = `list-style-1-${uuidv4()}`;
      const name2 = `list-style-2-${uuidv4()}`;
      await createOutputStyle(client, name1, '# 1');
      await createOutputStyle(client, name2, '# 2');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleListPayload, OutputStyleListResultPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_LIST,
        WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const names = response.styles!.map((s) => s.name);
      expect(names).toContain(name1);
      expect(names).toContain(name2);
    });
  });

  describe('OutputStyle 讀取', () => {
    it('success_when_output_style_read_returns_content', async () => {
      const name = `read-style-${uuidv4()}`;
      const style = await createOutputStyle(client, name, '# Read Content');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleReadPayload, OutputStyleReadResultPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_READ,
        WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
        { requestId: uuidv4(), canvasId, outputStyleId: style.id }
      );

      expect(response.success).toBe(true);
      expect(response.outputStyle!.content).toBe('# Read Content');
    });

    it('failed_when_output_style_read_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleReadPayload, OutputStyleReadResultPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_READ,
        WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
        { requestId: uuidv4(), canvasId, outputStyleId: FAKE_STYLE_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('OutputStyle 更新', () => {
    it('success_when_output_style_updated', async () => {
      const style = await createOutputStyle(client, `upd-style-${uuidv4()}`, '# Old');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleUpdatePayload, OutputStyleUpdatedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_UPDATE,
        WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
        { requestId: uuidv4(), canvasId, outputStyleId: style.id, content: '# New' }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_output_style_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleUpdatePayload, OutputStyleUpdatedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_UPDATE,
        WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
        { requestId: uuidv4(), canvasId, outputStyleId: FAKE_STYLE_ID, content: '# Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('OutputStyle 刪除', () => {
    it('success_when_output_style_deleted', async () => {
      const style = await createOutputStyle(client, `del-style-${uuidv4()}`, '# Del');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleDeletePayload, OutputStyleDeletedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
        WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
        { requestId: uuidv4(), canvasId, outputStyleId: style.id }
      );

      expect(response.success).toBe(true);
      expect(response.deletedNoteIds).toBeDefined();
    });

    it('failed_when_output_style_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<OutputStyleDeletePayload, OutputStyleDeletedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
        WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
        { requestId: uuidv4(), canvasId, outputStyleId: FAKE_STYLE_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_output_style_delete_while_in_use', async () => {
      const style = await createOutputStyle(client, `inuse-style-${uuidv4()}`, '# InUse');
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, outputStyleId: style.id }
      );

      const response = await emitAndWaitResponse<OutputStyleDeletePayload, OutputStyleDeletedPayload>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
        WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
        { requestId: uuidv4(), canvasId, outputStyleId: style.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('使用中');
    });
  });

  describe('Pod 綁定 OutputStyle', () => {
    it('success_when_output_style_bound_to_pod', async () => {
      const pod = await createPod(client);
      const style = await createOutputStyle(client, `bind-style-${uuidv4()}`, '# Bind');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, outputStyleId: style.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.outputStyleId).toBe(style.id);
    });

    it('failed_when_bind_output_style_with_nonexistent_pod', async () => {
      const style = await createOutputStyle(client, `bind-np-${uuidv4()}`, '# NP');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, outputStyleId: style.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_output_style_with_nonexistent_style', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, outputStyleId: FAKE_STYLE_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Pod 解除綁定 OutputStyle', () => {
    it('success_when_output_style_unbound_from_pod', async () => {
      const pod = await createPod(client);
      const style = await createOutputStyle(client, `unbind-style-${uuidv4()}`, '# UB');

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, outputStyleId: style.id }
      );

      const response = await emitAndWaitResponse<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.outputStyleId).toBeNull();
    });

    it('failed_when_unbind_output_style_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
