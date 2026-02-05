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
import { createOutputStyle, createSkillFile, FAKE_UUID, FAKE_STYLE_ID, getCanvasId} from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type NoteCreatePayload,
  type NoteUpdatePayload,
  type NoteDeletePayload,
  type SkillNoteCreatePayload,
  type SkillNoteUpdatePayload,
  type SkillNoteDeletePayload,
} from '../../src/schemas/index.js';
import {
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NoteDeletedPayload,
  type SkillNoteCreatedPayload,
  type SkillNoteUpdatedPayload,
  type SkillNoteDeletedPayload,
} from '../../src/types/index.js';

describe('Note Handler 覆蓋率測試', () => {
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

  describe('OutputStyle Note Handler', () => {
    it('failed_when_validate_before_create_fails', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          outputStyleId: FAKE_STYLE_ID,
          name: 'Test Note',
          x: 100,
          y: 100,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('success_when_validate_before_create_passes', async () => {
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Test');
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
          y: 100,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      expect(response.success).toBe(true);
      expect(response.note).toBeDefined();
      expect(response.note!.name).toBe('Test Note');
    });

    it('success_when_no_validate_function_skips_check', async () => {
      const skillId = await createSkillFile(`skill-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);

      const response = await emitAndWaitResponse<SkillNoteCreatePayload, SkillNoteCreatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_CREATE,
        WebSocketResponseEvents.SKILL_NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          skillId,
          name: 'Skill Note',
          x: 100,
          y: 100,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      expect(response.success).toBe(true);
      expect(response.note).toBeDefined();
    });

    it('failed_when_note_not_found_on_update', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          noteId: FAKE_UUID,
          x: 500,
        }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_update_returns_undefined', async () => {
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);
      const createResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          outputStyleId: style.id,
          name: 'Note',
          x: 100,
          y: 100,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      const noteId = createResponse.note!.id;

      await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId }
      );

      const updateResponse = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          noteId,
          x: 500,
        }
      );

      expect(updateResponse.success).toBe(false);
      expect(updateResponse.error).toContain('找不到');
    });

    it('failed_when_note_not_found_on_delete', async () => {
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

    it('failed_when_delete_returns_false', async () => {
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);
      const createResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          outputStyleId: style.id,
          name: 'Note',
          x: 100,
          y: 100,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      const noteId = createResponse.note!.id;
      await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId }
      );

      const deleteResponse = await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId }
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toContain('找不到');
    });

    it('success_when_partial_update_only_updates_provided_fields', async () => {
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);
      const createResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          outputStyleId: style.id,
          name: 'Original Note',
          x: 100,
          y: 200,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      const noteId = createResponse.note!.id;

      const updateResponse = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          noteId,
          x: 500,
        }
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.note!.x).toBe(500);
      expect(updateResponse.note!.y).toBe(200);
      expect(updateResponse.note!.name).toBe('Original Note');
    });
  });

  describe('Skill Note Handler', () => {
    it('failed_when_skill_note_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_UPDATE,
        WebSocketResponseEvents.SKILL_NOTE_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          noteId: FAKE_UUID,
          x: 500,
        }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_skill_note_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteDeletePayload, SkillNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_DELETE,
        WebSocketResponseEvents.SKILL_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('success_when_skill_note_partial_update', async () => {
      const skillId = await createSkillFile(`skill-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);
      const createResponse = await emitAndWaitResponse<SkillNoteCreatePayload, SkillNoteCreatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_CREATE,
        WebSocketResponseEvents.SKILL_NOTE_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          skillId,
          name: 'Original Skill Note',
          x: 100,
          y: 200,
          boundToPodId: null,
          originalPosition: null,
        }
      );

      const noteId = createResponse.note!.id;

      const updateResponse = await emitAndWaitResponse<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_UPDATE,
        WebSocketResponseEvents.SKILL_NOTE_UPDATED,
        {
          requestId: uuidv4(),
          canvasId,
          noteId,
          y: 300,
        }
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.note!.x).toBe(100);
      expect(updateResponse.note!.y).toBe(300);
      expect(updateResponse.note!.name).toBe('Original Skill Note');
    });
  });
});
