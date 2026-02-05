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
import { createPod, createOutputStyle, FAKE_UUID, getCanvasId} from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type NoteCreatePayload,
  type NoteListPayload,
  type NoteUpdatePayload,
  type NoteDeletePayload,
} from '../../src/schemas';
import {
  type NoteCreatedPayload,
  type NoteListResultPayload,
  type NoteUpdatedPayload,
  type NoteDeletedPayload,
} from '../../src/types';

describe('OutputStyle Note 管理', () => {
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

  async function createTestNote(boundToPodId: string | null = null) {
    const style = await createOutputStyle(client, `note-style-${uuidv4()}`, '# S');
    const canvasId = await getCanvasId(client);

    const response = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
      client,
      WebSocketRequestEvents.NOTE_CREATE,
      WebSocketResponseEvents.NOTE_CREATED,
      {
        requestId: uuidv4(),
        canvasId,
        outputStyleId: style.id,
        name: 'Test Note',
        x: 100,
        y: 200,
        boundToPodId,
        originalPosition: null,
      }
    );

    return response.note!;
  }

  describe('Note 建立', () => {
    it('success_when_note_created', async () => {
      const note = await createTestNote();

      expect(note.id).toBeDefined();
      expect(note.name).toBe('Test Note');
      expect(note.x).toBe(100);
      expect(note.y).toBe(200);
      expect(note.boundToPodId).toBeNull();
    });

    it('success_when_note_created_with_pod_binding', async () => {
      const pod = await createPod(client);
      const note = await createTestNote(pod.id);

      expect(note.boundToPodId).toBe(pod.id);
    });
  });

  describe('Note 列表', () => {
    it('success_when_note_list_returns_all_notes', async () => {
      await createTestNote();
      await createTestNote();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteListPayload, NoteListResultPayload>(
        client,
        WebSocketRequestEvents.NOTE_LIST,
        WebSocketResponseEvents.NOTE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(response.notes!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Note 更新', () => {
    it('success_when_note_updated_with_position', async () => {
      const note = await createTestNote();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: note.id, x: 999, y: 888 }
      );

      expect(response.success).toBe(true);
      expect(response.note!.x).toBe(999);
      expect(response.note!.y).toBe(888);
    });

    it('success_when_note_updated_with_binding', async () => {
      const note = await createTestNote();
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: note.id, boundToPodId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.note!.boundToPodId).toBe(pod.id);
    });

    it('failed_when_note_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID, x: 0 }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Note 刪除', () => {
    it('success_when_note_deleted', async () => {
      const note = await createTestNote();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: note.id }
      );

      expect(response.success).toBe(true);
      expect(response.noteId).toBe(note.id);
    });

    it('failed_when_note_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
