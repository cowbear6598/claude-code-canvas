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
import { createPod, createSubAgent, createRepository, getCanvasId, FAKE_UUID, FAKE_SUBAGENT_ID } from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type SubAgentCreatePayload,
  type SubAgentListPayload,
  type SubAgentReadPayload,
  type SubAgentUpdatePayload,
  type SubAgentNoteCreatePayload,
  type SubAgentNoteListPayload,
  type SubAgentNoteUpdatePayload,
  type SubAgentNoteDeletePayload,
  type PodBindSubAgentPayload,
  type PodBindRepositoryPayload,
  type SubAgentDeletePayload,
} from '../../src/schemas';
import {
  type SubAgentCreatedPayload,
  type SubAgentListResultPayload,
  type SubAgentReadResultPayload,
  type SubAgentUpdatedPayload,
  type SubAgentNoteCreatedPayload,
  type SubAgentNoteListResultPayload,
  type SubAgentNoteUpdatedPayload,
  type SubAgentNoteDeletedPayload,
  type PodSubAgentBoundPayload,
  type PodRepositoryBoundPayload,
  type SubAgentDeletedPayload,
} from '../../src/types';

describe('SubAgent 管理', () => {
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

  async function makeAgent(name?: string) {
    return createSubAgent(client, name ?? `agent-${uuidv4()}`, '# Agent Content');
  }

  async function createAgentNote(subAgentId: string) {
    const canvasId = await getCanvasId(client);
    const response = await emitAndWaitResponse<SubAgentNoteCreatePayload, SubAgentNoteCreatedPayload>(
      client,
      WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
      { requestId: uuidv4(), canvasId, subAgentId, name: 'Agent Note', x: 100, y: 100, boundToPodId: null, originalPosition: null }
    );
    return response.note!;
  }

  describe('SubAgent 建立', () => {
    it('success_when_subagent_created', async () => {
      const name = `sa-${uuidv4()}`;
      const agent = await makeAgent(name);

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe(name);
    });

    it('failed_when_subagent_create_with_duplicate_name', async () => {
      const name = `dup-sa-${uuidv4()}`;
      await makeAgent(name);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentCreatePayload, SubAgentCreatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_CREATE,
        WebSocketResponseEvents.SUBAGENT_CREATED,
        { requestId: uuidv4(), canvasId, name, content: '# Dup' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已存在');
    });
  });

  describe('SubAgent 列表', () => {
    it('success_when_subagent_list_returns_all', async () => {
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentListPayload, SubAgentListResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_LIST,
        WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      const names = response.subAgents!.map((s) => s.name);
      expect(names).toContain(agent.name);
    });
  });

  describe('SubAgent 讀取', () => {
    it('success_when_subagent_read_returns_content', async () => {
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentReadPayload, SubAgentReadResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_READ,
        WebSocketResponseEvents.SUBAGENT_READ_RESULT,
        { requestId: uuidv4(), canvasId, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.subAgent!.content).toBe('# Agent Content');
    });

    it('failed_when_subagent_read_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentReadPayload, SubAgentReadResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_READ,
        WebSocketResponseEvents.SUBAGENT_READ_RESULT,
        { requestId: uuidv4(), canvasId, subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('SubAgent 更新', () => {
    it('success_when_subagent_updated', async () => {
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentUpdatePayload, SubAgentUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_UPDATE,
        WebSocketResponseEvents.SUBAGENT_UPDATED,
        { requestId: uuidv4(), canvasId, subAgentId: agent.id, content: '# Updated' }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_subagent_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentUpdatePayload, SubAgentUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_UPDATE,
        WebSocketResponseEvents.SUBAGENT_UPDATED,
        { requestId: uuidv4(), canvasId, subAgentId: FAKE_SUBAGENT_ID, content: '# Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('SubAgent Note CRUD', () => {
    it('success_when_subagent_note_created', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      expect(note.id).toBeDefined();
      expect(note.subAgentId).toBe(agent.id);
    });

    it('success_when_subagent_note_list_returns_all', async () => {
      const agent = await makeAgent();
      await createAgentNote(agent.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentNoteListPayload, SubAgentNoteListResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
        WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
        { requestId: uuidv4(), canvasId }
      );

      expect(response.success).toBe(true);
      expect(response.notes!.length).toBeGreaterThanOrEqual(1);
    });

    it('success_when_subagent_note_updated', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
        WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: note.id, x: 777 }
      );

      expect(response.success).toBe(true);
      expect(response.note!.x).toBe(777);
    });

    it('failed_when_subagent_note_update_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
        WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID, x: 0 }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('success_when_subagent_note_deleted', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentNoteDeletePayload, SubAgentNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
        WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: note.id }
      );

      expect(response.success).toBe(true);
      expect(response.noteId).toBe(note.id);
    });

    it('failed_when_subagent_note_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentNoteDeletePayload, SubAgentNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
        WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
        { requestId: uuidv4(), canvasId, noteId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });

  describe('Pod 綁定 SubAgent', () => {
    it('success_when_subagent_bound_to_pod', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.subAgentIds).toContain(agent.id);
    });

    it('success_when_subagent_bound_to_pod_with_repository', async () => {
      const pod = await createPod(client);
      const repo = await createRepository(client, `sa-repo-${uuidv4()}`);

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, repositoryId: repo.id }
      );

      const agent = await makeAgent();

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.subAgentIds).toContain(agent.id);
    });

    it('failed_when_bind_subagent_with_nonexistent_pod', async () => {
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID, subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_subagent_with_nonexistent_subagent', async () => {
      const pod = await createPod(client);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_bind_subagent_already_bound', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: agent.id }
      );

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已綁定');
    });
  });

  describe('SubAgent 刪除', () => {
    it('success_when_subagent_deleted', async () => {
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), canvasId, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_subagent_delete_with_nonexistent_id', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), canvasId, subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });

    it('failed_when_subagent_delete_while_in_use', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: agent.id }
      );

      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), canvasId, subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('使用中');
    });
  });
});
