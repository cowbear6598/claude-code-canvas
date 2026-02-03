import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Socket} from 'socket.io-client';
import {v4 as uuidv4} from 'uuid';
import {
    closeTestServer,
    createSocketClient,
    createTestServer,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance,
} from '../setup/index.js';
import {createPod, createRepository, FAKE_REPO_ID, FAKE_UUID} from '../helpers/index.js';
import {
    type PodBindRepositoryPayload,
    type PodRepositoryBoundPayload,
    type PodRepositoryUnboundPayload,
    type PodUnbindRepositoryPayload,
    type RepositoryCreatedPayload,
    type RepositoryCreatePayload,
    type RepositoryDeletedPayload,
    type RepositoryDeletePayload,
    type RepositoryListPayload,
    type RepositoryListResultPayload,
    type RepositoryNoteCreatedPayload,
    type RepositoryNoteCreatePayload,
    type RepositoryNoteDeletedPayload,
    type RepositoryNoteDeletePayload,
    type RepositoryNoteListPayload,
    type RepositoryNoteListResultPayload,
    type RepositoryNoteUpdatedPayload,
    type RepositoryNoteUpdatePayload,
    WebSocketRequestEvents,
    WebSocketResponseEvents,
} from '../../src/types/index.js';

describe('repository', () => {
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

    async function createRepoNote(repositoryId: string) {
        return await emitAndWaitResponse<RepositoryNoteCreatePayload, RepositoryNoteCreatedPayload>(
            client,
            WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
            WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
            {
                requestId: uuidv4(),
                repositoryId,
                name: 'Repo Note',
                x: 100,
                y: 100,
                boundToPodId: null,
                originalPosition: null
            }
        );
    }

    describe('handleRepositoryCreate', () => {
        it('success_when_repository_created', async () => {
            const name = `repo-${uuidv4()}`;
            const repo = await createRepository(client, name);

            expect(repo.id).toBeDefined();
            expect(repo.name).toBe(name);
        });

        it('failed_when_repository_create_with_duplicate_name', async () => {
            const name = `dup-repo-${uuidv4()}`;
            await createRepository(client, name);

            const response = await emitAndWaitResponse<RepositoryCreatePayload, RepositoryCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_CREATE,
                WebSocketResponseEvents.REPOSITORY_CREATED,
                {requestId: uuidv4(), name}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('already exists');
        });
    });

    describe('handleRepositoryList', () => {
        it('success_when_repository_list_returns_all', async () => {
            const name = `list-repo-${uuidv4()}`;
            await createRepository(client, name);

            const response = await emitAndWaitResponse<RepositoryListPayload, RepositoryListResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_LIST,
                WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
                {requestId: uuidv4()}
            );

            expect(response.success).toBe(true);
            const names = response.repositories!.map((r) => r.name);
            expect(names).toContain(name);
        });
    });

    describe('repository note CRUD', () => {
        it('success_when_repository_note_created', async () => {
            const repo = await createRepository(client, `rn-${uuidv4()}`);
            const response = await createRepoNote(repo.id);

            expect(response.success).toBe(true);
            expect(response.note!.repositoryId).toBe(repo.id);
        });

        it('failed_when_repository_note_create_with_nonexistent_repository', async () => {
            const response = await emitAndWaitResponse<RepositoryNoteCreatePayload, RepositoryNoteCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
                {
                    requestId: uuidv4(),
                    repositoryId: FAKE_REPO_ID,
                    name: 'Bad',
                    x: 0,
                    y: 0,
                    boundToPodId: null,
                    originalPosition: null
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });

        it('success_when_repository_note_list_returns_all', async () => {
            const repo = await createRepository(client, `rnl-${uuidv4()}`);
            await createRepoNote(repo.id);

            const response = await emitAndWaitResponse<RepositoryNoteListPayload, RepositoryNoteListResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
                WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
                {requestId: uuidv4()}
            );

            expect(response.success).toBe(true);
            expect(response.notes!.length).toBeGreaterThanOrEqual(1);
        });

        it('success_when_repository_note_updated', async () => {
            const repo = await createRepository(client, `rnu-${uuidv4()}`);
            const {note} = await createRepoNote(repo.id);

            const response = await emitAndWaitResponse<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
                {requestId: uuidv4(), noteId: note!.id, x: 999}
            );

            expect(response.success).toBe(true);
            expect(response.note!.x).toBe(999);
        });

        it('failed_when_repository_note_update_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
                {requestId: uuidv4(), noteId: FAKE_UUID, x: 0}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });

        it('success_when_repository_note_deleted', async () => {
            const repo = await createRepository(client, `rnd-${uuidv4()}`);
            const {note} = await createRepoNote(repo.id);

            const response = await emitAndWaitResponse<RepositoryNoteDeletePayload, RepositoryNoteDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
                WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
                {requestId: uuidv4(), noteId: note!.id}
            );

            expect(response.success).toBe(true);
            expect(response.noteId).toBe(note!.id);
        });

        it('failed_when_repository_note_delete_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<RepositoryNoteDeletePayload, RepositoryNoteDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
                WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
                {requestId: uuidv4(), noteId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });
    });

    describe('handlePodBindRepository', () => {
        it('success_when_repository_bound_to_pod', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `bind-repo-${uuidv4()}`);

            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), podId: pod.id, repositoryId: repo.id}
            );

            expect(response.success).toBe(true);
            expect(response.pod!.repositoryId).toBe(repo.id);
        });

        it('failed_when_bind_repository_with_nonexistent_pod', async () => {
            const repo = await createRepository(client, `bind-np-${uuidv4()}`);

            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), podId: FAKE_UUID, repositoryId: repo.id}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });

        it('failed_when_bind_repository_with_nonexistent_repository', async () => {
            const pod = await createPod(client);

            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), podId: pod.id, repositoryId: FAKE_REPO_ID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });
    });

    describe('handlePodUnbindRepository', () => {
        it('success_when_repository_unbound_from_pod', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `unbind-repo-${uuidv4()}`);

            await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), podId: pod.id, repositoryId: repo.id}
            );

            const response = await emitAndWaitResponse<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>(
                client,
                WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
                {requestId: uuidv4(), podId: pod.id}
            );

            expect(response.success).toBe(true);
            expect(response.pod!.repositoryId).toBeNull();
        });

        it('failed_when_unbind_repository_with_nonexistent_pod', async () => {
            const response = await emitAndWaitResponse<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>(
                client,
                WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
                {requestId: uuidv4(), podId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });
    });

    describe('handleRepositoryDelete', () => {
        it('success_when_repository_deleted', async () => {
            const repo = await createRepository(client, `del-repo-${uuidv4()}`);

            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), repositoryId: repo.id}
            );

            expect(response.success).toBe(true);
        });

        it('failed_when_repository_delete_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), repositoryId: FAKE_REPO_ID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('not found');
        });

        it('failed_when_repository_delete_while_in_use', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `inuse-repo-${uuidv4()}`);

            await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), podId: pod.id, repositoryId: repo.id}
            );

            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), repositoryId: repo.id}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('in use');
        });
    });
});
