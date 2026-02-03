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
import { createPod, createSubAgent, createRepository, FAKE_UUID, FAKE_SUBAGENT_ID } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type SubAgentCreatePayload,
  type SubAgentCreatedPayload,
  type SubAgentListPayload,
  type SubAgentListResultPayload,
  type SubAgentReadPayload,
  type SubAgentReadResultPayload,
  type SubAgentUpdatePayload,
  type SubAgentUpdatedPayload,
  type SubAgentNoteCreatePayload,
  type SubAgentNoteCreatedPayload,
  type SubAgentNoteListPayload,
  type SubAgentNoteListResultPayload,
  type SubAgentNoteUpdatePayload,
  type SubAgentNoteUpdatedPayload,
  type SubAgentNoteDeletePayload,
  type SubAgentNoteDeletedPayload,
  type PodBindSubAgentPayload,
  type PodSubAgentBoundPayload,
  type PodBindRepositoryPayload,
  type PodRepositoryBoundPayload,
  type SubAgentDeletePayload,
  type SubAgentDeletedPayload,
} from '../../src/types/index.js';

describe('subagent', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  async function makeAgent(name?: string) {
    return createSubAgent(client, name ?? `agent-${uuidv4()}`, '# Agent Content');
  }

  async function createAgentNote(subAgentId: string) {
    const response = await emitAndWaitResponse<SubAgentNoteCreatePayload, SubAgentNoteCreatedPayload>(
      client,
      WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
      { requestId: uuidv4(), subAgentId, name: 'Agent Note', x: 100, y: 100, boundToPodId: null, originalPosition: null }
    );
    return response.note!;
  }

  describe('handleSubAgentCreate', () => {
    it('success_when_subagent_created', async () => {
      const name = `sa-${uuidv4()}`;
      const agent = await makeAgent(name);

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe(name);
    });

    it('failed_when_subagent_create_with_duplicate_name', async () => {
      const name = `dup-sa-${uuidv4()}`;
      await makeAgent(name);

      const response = await emitAndWaitResponse<SubAgentCreatePayload, SubAgentCreatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_CREATE,
        WebSocketResponseEvents.SUBAGENT_CREATED,
        { requestId: uuidv4(), name, content: '# Dup' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('already exists');
    });
  });

  describe('handleSubAgentList', () => {
    it('success_when_subagent_list_returns_all', async () => {
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<SubAgentListPayload, SubAgentListResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_LIST,
        WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
        { requestId: uuidv4() }
      );

      expect(response.success).toBe(true);
      const names = response.subAgents!.map((s) => s.name);
      expect(names).toContain(agent.name);
    });
  });

  describe('handleSubAgentRead', () => {
    it('success_when_subagent_read_returns_content', async () => {
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<SubAgentReadPayload, SubAgentReadResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_READ,
        WebSocketResponseEvents.SUBAGENT_READ_RESULT,
        { requestId: uuidv4(), subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.subAgent!.content).toBe('# Agent Content');
    });

    it('failed_when_subagent_read_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<SubAgentReadPayload, SubAgentReadResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_READ,
        WebSocketResponseEvents.SUBAGENT_READ_RESULT,
        { requestId: uuidv4(), subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  describe('handleSubAgentUpdate', () => {
    it('success_when_subagent_updated', async () => {
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<SubAgentUpdatePayload, SubAgentUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_UPDATE,
        WebSocketResponseEvents.SUBAGENT_UPDATED,
        { requestId: uuidv4(), subAgentId: agent.id, content: '# Updated' }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_subagent_update_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<SubAgentUpdatePayload, SubAgentUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_UPDATE,
        WebSocketResponseEvents.SUBAGENT_UPDATED,
        { requestId: uuidv4(), subAgentId: FAKE_SUBAGENT_ID, content: '# Fail' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  describe('subagent note CRUD', () => {
    it('success_when_subagent_note_created', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      expect(note.id).toBeDefined();
      expect(note.subAgentId).toBe(agent.id);
    });

    it('success_when_subagent_note_list_returns_all', async () => {
      const agent = await makeAgent();
      await createAgentNote(agent.id);

      const response = await emitAndWaitResponse<SubAgentNoteListPayload, SubAgentNoteListResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
        WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
        { requestId: uuidv4() }
      );

      expect(response.success).toBe(true);
      expect(response.notes!.length).toBeGreaterThanOrEqual(1);
    });

    it('success_when_subagent_note_updated', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      const response = await emitAndWaitResponse<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
        WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
        { requestId: uuidv4(), noteId: note.id, x: 777 }
      );

      expect(response.success).toBe(true);
      expect(response.note!.x).toBe(777);
    });

    it('failed_when_subagent_note_update_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
        WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
        { requestId: uuidv4(), noteId: FAKE_UUID, x: 0 }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('success_when_subagent_note_deleted', async () => {
      const agent = await makeAgent();
      const note = await createAgentNote(agent.id);

      const response = await emitAndWaitResponse<SubAgentNoteDeletePayload, SubAgentNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
        WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
        { requestId: uuidv4(), noteId: note.id }
      );

      expect(response.success).toBe(true);
      expect(response.noteId).toBe(note.id);
    });

    it('failed_when_subagent_note_delete_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<SubAgentNoteDeletePayload, SubAgentNoteDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
        WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
        { requestId: uuidv4(), noteId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  describe('handlePodBindSubAgent', () => {
    it('success_when_subagent_bound_to_pod', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.subAgentIds).toContain(agent.id);
    });

    it('success_when_subagent_bound_to_pod_with_repository', async () => {
      const pod = await createPod(client);
      const repo = await createRepository(client, `sa-repo-${uuidv4()}`);

      await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        { requestId: uuidv4(), podId: pod.id, repositoryId: repo.id }
      );

      const agent = await makeAgent();

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.subAgentIds).toContain(agent.id);
    });

    it('failed_when_bind_subagent_with_nonexistent_pod', async () => {
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: FAKE_UUID, subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('failed_when_bind_subagent_with_nonexistent_subagent', async () => {
      const pod = await createPod(client);

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('failed_when_bind_subagent_already_bound', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: agent.id }
      );

      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('already bound');
    });
  });

  describe('handleSubAgentDelete', () => {
    it('success_when_subagent_deleted', async () => {
      const agent = await makeAgent();

      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), subAgentId: agent.id }
      );

      expect(response.success).toBe(true);
    });

    it('failed_when_subagent_delete_with_nonexistent_id', async () => {
      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), subAgentId: FAKE_SUBAGENT_ID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('failed_when_subagent_delete_while_in_use', async () => {
      const pod = await createPod(client);
      const agent = await makeAgent();

      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), podId: pod.id, subAgentId: agent.id }
      );

      const response = await emitAndWaitResponse<SubAgentDeletePayload, SubAgentDeletedPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        { requestId: uuidv4(), subAgentId: agent.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('in use');
    });
  });
});
