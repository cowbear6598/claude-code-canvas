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
import { createPod, createCommand, getCanvasId, FAKE_UUID, FAKE_COMMAND_ID } from '../helpers';
import { podStore } from '../../src/services/podStore.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type CommandCreatePayload,
  type CommandListPayload,
  type CommandReadPayload,
  type CommandUpdatePayload,
  type CommandNoteCreatePayload,
  type CommandNoteListPayload,
  type CommandNoteUpdatePayload,
  type CommandNoteDeletePayload,
  type PodBindCommandPayload,
  type PodUnbindCommandPayload,
  type CommandDeletePayload,
} from '../../src/schemas';
import {
  type CommandCreatedPayload,
  type CommandListResultPayload,
  type CommandReadResultPayload,
  type CommandUpdatedPayload,
  type CommandNoteCreatedPayload,
  type CommandNoteListResultPayload,
  type CommandNoteUpdatedPayload,
  type CommandNoteDeletedPayload,
  type PodCommandBoundPayload,
  type PodCommandUnboundPayload,
  type CommandDeletedPayload,
} from '../../src/types';

describe('Command 管理', () => {
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

  async function makeCommand(name?: string) {
    return createCommand(client, name ?? `cmd-${uuidv4()}`, '# Command Content');
  }

  async function createCommandNote(commandId: string) {
    const canvasId = await getCanvasId(client);
    const response = await emitAndWaitResponse<CommandNoteCreatePayload, CommandNoteCreatedPayload>(
      client,
      WebSocketRequestEvents.COMMAND_NOTE_CREATE,
      WebSocketResponseEvents.COMMAND_NOTE_CREATED,
      { requestId: uuidv4(), canvasId, commandId, name: 'Cmd Note', x: 100, y: 100, boundToPodId: null, originalPosition: null }
    );
    return response.note!;
  }

  describe('Command 建立', () => {
    it('success_when_command_created', async () => {
      const name = `cmd-${uuidv4()}`;
      const cmd = await makeCommand(name);

      expect(cmd.id).toBeDefined();
      expect(cmd.name).toBe(name);
    });

    it('failed_when_command_create_with_duplicate_name', async () => {
      const name = `dup-cmd-${uuidv4()}`;
      await makeCommand(name);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandCreatePayload, CommandCreatedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_CREATE,
        WebSocketResponseEvents.COMMAND_CREATED,
        { requestId: uuidv4(), canvasId, name, content: '# Dup' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已存在');
    });
  });

  describe('Command 列表', () => {
    it('success_when_command_list_returns_all', async () => {
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandListPayload, CommandListResultPayload>(
        client,
        WebSocketRequestEvents.COMMAND_LIST,
        WebSocketResponseEvents.COMMAND_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const names = response.commands!.map((c) => c.name);
      expect(names).toContain(cmd.name);
    });
  });

  describe('Command 讀取', () => {
    it('success_when_command_read_returns_content', async () => {
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandReadPayload, CommandReadResultPayload>(
        client,
        WebSocketRequestEvents.COMMAND_READ,
        WebSocketResponseEvents.COMMAND_READ_RESULT,
        { requestId: uuidv4(), canvasId, commandId: cmd.id }
      );

      expect(response.success).toBe(true);
      expect(response.command!.content).toBe('# Command Content');
    });

    it('failed_when_command_read_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandReadPayload, CommandReadResultPayload>(
        client,
        WebSocketRequestEvents.COMMAND_READ,
        WebSocketResponseEvents.COMMAND_READ_RESULT,
        { requestId: uuidv4(), canvasId, commandId: FAKE_COMMAND_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Command 更新', () => {
    it('success_when_command_updated', async () => {
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandUpdatePayload, CommandUpdatedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_UPDATE,
        WebSocketResponseEvents.COMMAND_UPDATED,
        { requestId: uuidv4(), canvasId, commandId: cmd.id, content: '# Updated' }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_command_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandUpdatePayload, CommandUpdatedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_UPDATE,
        WebSocketResponseEvents.COMMAND_UPDATED,
        { requestId: uuidv4(), canvasId, commandId: FAKE_COMMAND_ID, content: '# Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Command Note CRUD', () => {
    it('success_when_command_note_created', async () => {
      const cmd = await makeCommand();
      const note = await createCommandNote(cmd.id);

      expect(note.id).toBeDefined();
      expect(note.commandId).toBe(cmd.id);
    });

    it('success_when_command_note_list_returns_all', async () => {
      const cmd = await makeCommand();
      await createCommandNote(cmd.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandNoteListPayload, CommandNoteListResultPayload>(
        client,
        WebSocketRequestEvents.COMMAND_NOTE_LIST,
        WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(response.notes!.length).toBeGreaterThanOrEqual(1);
    });

    it('success_when_command_note_updated', async () => {
      const cmd = await makeCommand();
      const note = await createCommandNote(cmd.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandNoteUpdatePayload, CommandNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_NOTE_UPDATE,
        WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: note.id, x: 555 }
      );

      expect(response.success).toBe(true);
      expect(response.note!.x).toBe(555);
    });

    it('failed_when_command_note_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandNoteUpdatePayload, CommandNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_NOTE_UPDATE,
        WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID, x: 0 }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('success_when_command_note_deleted', async () => {
      const cmd = await makeCommand();
      const note = await createCommandNote(cmd.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandNoteDeletePayload, CommandNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_NOTE_DELETE,
        WebSocketResponseEvents.COMMAND_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: note.id }
      );

      expect(response.success).toBe(true);
      expect(response.noteId).toBe(note.id);
    });

    it('failed_when_command_note_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandNoteDeletePayload, CommandNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_NOTE_DELETE,
        WebSocketResponseEvents.COMMAND_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Pod 綁定 Command', () => {
    it('success_when_command_bound_to_pod', async () => {
      const pod = await createPod(client);
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.commandId).toBe(cmd.id);
    });

    it('failed_when_bind_command_with_nonexistent_pod', async () => {
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, commandId: cmd.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_command_with_nonexistent_command', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: FAKE_COMMAND_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_command_while_pod_already_has_command', async () => {
      const pod = await createPod(client);
      const cmd1 = await makeCommand();
      const cmd2 = await makeCommand();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd1.id }
      );

      const response = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd2.id }
      );

      expect(response.success).toBe(false);
    });

    it('success_when_command_bound_persists_after_reload', async () => {
      const pod = await createPod(client);
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd.id }
      );

      const canvasModule = await import('../../src/services/canvasStore.js');
      const canvasDir = canvasModule.canvasStore.getCanvasDir(canvasId);

      if (!canvasDir) {
        throw new Error('Canvas directory not found');
      }

      await podStore.loadFromDisk(canvasId, canvasDir);

      const reloadedPod = podStore.getById(canvasId, pod.id);
      expect(reloadedPod).toBeDefined();
      expect(reloadedPod!.commandId).toBe(cmd.id);
    });
  });

  describe('Pod 解除綁定 Command', () => {
    it('success_when_command_unbound_from_pod', async () => {
      const pod = await createPod(client);
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd.id }
      );

      const response = await emitAndWaitResponse<PodUnbindCommandPayload, PodCommandUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.commandId).toBeNull();
    });

    it('success_when_unbind_command_from_pod_without_command', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUnbindCommandPayload, PodCommandUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_unbind_command_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUnbindCommandPayload, PodCommandUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Command 刪除', () => {
    it('success_when_command_deleted', async () => {
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandDeletePayload, CommandDeletedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_DELETE,
        WebSocketResponseEvents.COMMAND_DELETED,
        { requestId: uuidv4(), canvasId, commandId: cmd.id }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_command_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<CommandDeletePayload, CommandDeletedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_DELETE,
        WebSocketResponseEvents.COMMAND_DELETED,
        { requestId: uuidv4(), canvasId, commandId: FAKE_COMMAND_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_command_delete_while_in_use', async () => {
      const pod = await createPod(client);
      const cmd = await makeCommand();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_COMMAND,
        WebSocketResponseEvents.POD_COMMAND_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, commandId: cmd.id }
      );

      const response = await emitAndWaitResponse<CommandDeletePayload, CommandDeletedPayload>(
        client,
        WebSocketRequestEvents.COMMAND_DELETE,
        WebSocketResponseEvents.COMMAND_DELETED,
        { requestId: uuidv4(), canvasId, commandId: cmd.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('使用中');
    });
  });
});
