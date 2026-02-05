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
import { createPod, createSkillFile, getCanvasId, FAKE_UUID, FAKE_SKILL_ID } from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type SkillListPayload,
  type SkillNoteCreatePayload,
  type SkillNoteListPayload,
  type SkillNoteUpdatePayload,
  type SkillNoteDeletePayload,
  type PodBindSkillPayload,
  type SkillDeletePayload,
} from '../../src/schemas';
import {
  type SkillListResultPayload,
  type SkillNoteCreatedPayload,
  type SkillNoteListResultPayload,
  type SkillNoteUpdatedPayload,
  type SkillNoteDeletedPayload,
  type PodSkillBoundPayload,
  type SkillDeletedPayload,
} from '../../src/types';

describe('Skill 管理', () => {
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

  async function ensureSkill(name?: string): Promise<string> {
    const skillName = name ?? `skill-${uuidv4()}`;
    await createSkillFile(skillName, '# Test Skill');
    return skillName;
  }

  async function createSkillNote(skillId: string) {
      const canvasId = await getCanvasId(client);
    const response = await emitAndWaitResponse<SkillNoteCreatePayload, SkillNoteCreatedPayload>(
      client,
      WebSocketRequestEvents.SKILL_NOTE_CREATE,
      WebSocketResponseEvents.SKILL_NOTE_CREATED,
      { requestId: uuidv4(), canvasId, skillId, name: 'Skill Note', x: 100, y: 100, boundToPodId: null, originalPosition: null }
    );
    return response.note!;
  }

  describe('Skill 列表', () => {
    it('success_when_skill_list_returns_all_skills', async () => {
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillListPayload, SkillListResultPayload>(
        client,
        WebSocketRequestEvents.SKILL_LIST,
        WebSocketResponseEvents.SKILL_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const names = response.skills!.map((s) => s.name);
      expect(names).toContain(skillId);
    });
  });

  describe('Skill Note CRUD', () => {
    it('success_when_skill_note_created', async () => {
      const skillId = await ensureSkill();
      const note = await createSkillNote(skillId);

      expect(note.id).toBeDefined();
      expect(note.skillId).toBe(skillId);
    });

    it('success_when_skill_note_list_returns_all', async () => {
      const skillId = await ensureSkill();
      await createSkillNote(skillId);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteListPayload, SkillNoteListResultPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_LIST,
        WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(response.notes!.length).toBeGreaterThanOrEqual(1);
    });

    it('success_when_skill_note_updated', async () => {
      const skillId = await ensureSkill();
      const note = await createSkillNote(skillId);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_UPDATE,
        WebSocketResponseEvents.SKILL_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: note.id, x: 500, y: 600 }
      );

      expect(response.success).toBe(true);
      expect(response.note!.x).toBe(500);
    });

    it('failed_when_skill_note_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_UPDATE,
        WebSocketResponseEvents.SKILL_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID, x: 0 }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('success_when_skill_note_deleted', async () => {
      const skillId = await ensureSkill();
      const note = await createSkillNote(skillId);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillNoteDeletePayload, SkillNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_NOTE_DELETE,
        WebSocketResponseEvents.SKILL_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: note.id }
      );

      expect(response.success).toBe(true);
      expect(response.noteId).toBe(note.id);
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
  });

  describe('Pod 綁定 Skill', () => {
    it('success_when_skill_bound_to_pod', async () => {
      const pod = await createPod(client);
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.skillIds).toContain(skillId);
    });

    it('failed_when_bind_skill_with_nonexistent_pod', async () => {
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, skillId }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_skill_with_nonexistent_skill', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId: FAKE_SKILL_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_skill_already_bound', async () => {
      const pod = await createPod(client);
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      const response = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已綁定');
    });
  });

  describe('Skill 刪除', () => {
    it('success_when_skill_deleted', async () => {
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillDeletePayload, SkillDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_DELETE,
        WebSocketResponseEvents.SKILL_DELETED,
        { requestId: uuidv4(), canvasId, skillId }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_skill_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SkillDeletePayload, SkillDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_DELETE,
        WebSocketResponseEvents.SKILL_DELETED,
        { requestId: uuidv4(), canvasId, skillId: FAKE_SKILL_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_skill_delete_while_in_use', async () => {
      const pod = await createPod(client);
      const skillId = await ensureSkill();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      const response = await emitAndWaitResponse<SkillDeletePayload, SkillDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_DELETE,
        WebSocketResponseEvents.SKILL_DELETED,
        { requestId: uuidv4(), canvasId, skillId }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('使用中');
    });
  });
});
