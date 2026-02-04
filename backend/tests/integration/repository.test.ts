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
import {createPod, createRepository, FAKE_REPO_ID, FAKE_UUID, getCanvasId} from '../helpers/index.js';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type PodBindRepositoryPayload,
    type PodUnbindRepositoryPayload,
    type RepositoryCreatePayload,
    type RepositoryDeletePayload,
    type RepositoryListPayload,
    type RepositoryNoteCreatePayload,
    type RepositoryNoteDeletePayload,
    type RepositoryNoteListPayload,
    type RepositoryNoteUpdatePayload,
    type RepositoryCheckGitPayload,
    type RepositoryWorktreeCreatePayload,
} from '../../src/schemas/index.js';
import {
    type PodRepositoryBoundPayload,
    type PodRepositoryUnboundPayload,
    type RepositoryCreatedPayload,
    type RepositoryDeletedPayload,
    type RepositoryListResultPayload,
    type RepositoryNoteCreatedPayload,
    type RepositoryNoteDeletedPayload,
    type RepositoryNoteListResultPayload,
    type RepositoryNoteUpdatedPayload,
    type RepositoryCheckGitResultPayload,
    type RepositoryWorktreeCreatedPayload,
} from '../../src/types/index.js';

describe('Repository 管理', () => {
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

    async function createRepoNote(repositoryId: string) {
        const canvasId = await getCanvasId(client);
        return await emitAndWaitResponse<RepositoryNoteCreatePayload, RepositoryNoteCreatedPayload>(
            client,
            WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
            WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
            {
                requestId: uuidv4(),
                canvasId,
                repositoryId,
                name: 'Repo Note',
                x: 100,
                y: 100,
                boundToPodId: null,
                originalPosition: null
            }
        );
    }

    describe('Repository 建立', () => {
        it('success_when_repository_created', async () => {
            const name = `repo-${uuidv4()}`;
            const repo = await createRepository(client, name);

            expect(repo.id).toBeDefined();
            expect(repo.name).toBe(name);
        });

        it('failed_when_repository_create_with_duplicate_name', async () => {
            const name = `dup-repo-${uuidv4()}`;
            await createRepository(client, name);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryCreatePayload, RepositoryCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_CREATE,
                WebSocketResponseEvents.REPOSITORY_CREATED,
                {requestId: uuidv4(), canvasId, name}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('已存在');
        });
    });

    describe('Repository 列表', () => {
        it('success_when_repository_list_returns_all', async () => {
            const name = `list-repo-${uuidv4()}`;
            await createRepository(client, name);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryListPayload, RepositoryListResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_LIST,
                WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
                {requestId: uuidv4(), canvasId}
            );

            expect(response.success).toBe(true);
            const names = response.repositories!.map((r) => r.name);
            expect(names).toContain(name);
        });
    });

    describe('Repository Note CRUD', () => {
        it('success_when_repository_note_created', async () => {
            const repo = await createRepository(client, `rn-${uuidv4()}`);
            const response = await createRepoNote(repo.id);

            expect(response.success).toBe(true);
            expect(response.note!.repositoryId).toBe(repo.id);
        });

        it('failed_when_repository_note_create_with_nonexistent_repository', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteCreatePayload, RepositoryNoteCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
                {
                    requestId: uuidv4(),
                    canvasId,
                    repositoryId: FAKE_REPO_ID,
                    name: 'Bad',
                    x: 0,
                    y: 0,
                    boundToPodId: null,
                    originalPosition: null
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('success_when_repository_note_list_returns_all', async () => {
            const repo = await createRepository(client, `rnl-${uuidv4()}`);
            await createRepoNote(repo.id);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteListPayload, RepositoryNoteListResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
                WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
                {requestId: uuidv4(), canvasId}
            );

            expect(response.success).toBe(true);
            expect(response.notes!.length).toBeGreaterThanOrEqual(1);
        });

        it('success_when_repository_note_updated', async () => {
            const repo = await createRepository(client, `rnu-${uuidv4()}`);
            const {note} = await createRepoNote(repo.id);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
                {requestId: uuidv4(), canvasId, noteId: note!.id, x: 999}
            );

            expect(response.success).toBe(true);
            expect(response.note!.x).toBe(999);
        });

        it('failed_when_repository_note_update_with_nonexistent_id', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
                WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
                {requestId: uuidv4(), canvasId, noteId: FAKE_UUID, x: 0}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('success_when_repository_note_deleted', async () => {
            const repo = await createRepository(client, `rnd-${uuidv4()}`);
            const {note} = await createRepoNote(repo.id);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteDeletePayload, RepositoryNoteDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
                WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
                {requestId: uuidv4(), canvasId, noteId: note!.id}
            );

            expect(response.success).toBe(true);
            expect(response.noteId).toBe(note!.id);
        });

        it('failed_when_repository_note_delete_with_nonexistent_id', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryNoteDeletePayload, RepositoryNoteDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
                WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
                {requestId: uuidv4(), canvasId, noteId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });
    });

    describe('Pod 綁定 Repository', () => {
        it('success_when_repository_bound_to_pod', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `bind-repo-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), canvasId, podId: pod.id, repositoryId: repo.id}
            );

            expect(response.success).toBe(true);
            expect(response.pod!.repositoryId).toBe(repo.id);
        });

        it('failed_when_bind_repository_with_nonexistent_pod', async () => {
            const repo = await createRepository(client, `bind-np-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), canvasId, podId: FAKE_UUID, repositoryId: repo.id}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('failed_when_bind_repository_with_nonexistent_repository', async () => {
            const pod = await createPod(client);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), canvasId, podId: pod.id, repositoryId: FAKE_REPO_ID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });
    });

    describe('Pod 解除綁定 Repository', () => {
        it('success_when_repository_unbound_from_pod', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `unbind-repo-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), canvasId, podId: pod.id, repositoryId: repo.id}
            );

            const response = await emitAndWaitResponse<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>(
                client,
                WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
                {requestId: uuidv4(), canvasId, podId: pod.id}
            );

            expect(response.success).toBe(true);
            expect(response.pod!.repositoryId).toBeNull();
        });

        it('failed_when_unbind_repository_with_nonexistent_pod', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>(
                client,
                WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
                {requestId: uuidv4(), canvasId, podId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });
    });

    describe('Repository 刪除', () => {
        it('success_when_repository_deleted', async () => {
            const repo = await createRepository(client, `del-repo-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id}
            );

            expect(response.success).toBe(true);
        });

        it('failed_when_repository_delete_with_nonexistent_id', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), canvasId, repositoryId: FAKE_REPO_ID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('failed_when_repository_delete_while_in_use', async () => {
            const pod = await createPod(client);
            const repo = await createRepository(client, `inuse-repo-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
                client,
                WebSocketRequestEvents.POD_BIND_REPOSITORY,
                WebSocketResponseEvents.POD_REPOSITORY_BOUND,
                {requestId: uuidv4(), canvasId, podId: pod.id, repositoryId: repo.id}
            );

            const response = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('使用中');
        });
    });

    describe('Repository Git 檢查', () => {
        it('success_when_check_non_git_repository', async () => {
            const repo = await createRepository(client, `check-repo-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryCheckGitPayload, RepositoryCheckGitResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_CHECK_GIT,
                WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id}
            );

            expect(response.success).toBe(true);
            expect(response.isGit).toBe(false);
        });

        it('failed_when_check_git_with_nonexistent_repository', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryCheckGitPayload, RepositoryCheckGitResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_CHECK_GIT,
                WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
                {requestId: uuidv4(), canvasId, repositoryId: FAKE_REPO_ID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });
    });

    describe('Repository Worktree 建立', () => {
        it('failed_when_create_worktree_from_nonexistent_repository', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: FAKE_REPO_ID, worktreeName: 'feature'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到 Repository');
        });

        it('failed_when_create_worktree_from_non_git_repository', async () => {
            const repo = await createRepository(client, `worktree-non-git-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName: 'feature'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('不是 Git Repository');
        });

        it('failed_when_create_worktree_from_repository_without_commits', async () => {
            const repo = await createRepository(client, `worktree-no-commit-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const repoPath = path.join(config.repositoriesRoot, repo.id);
            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName: 'feature'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('沒有任何 commit');
        });

        it('success_when_worktree_created_with_parent_info', async () => {
            const repo = await createRepository(client, `worktree-parent-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const repoPath = path.join(config.repositoriesRoot, repo.id);

            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
            execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

            const worktreeName = 'feature-test';
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName}
            );

            expect(response.success).toBe(true);
            expect(response.repository!.parentRepoId).toBe(repo.id);
            expect(response.repository!.branchName).toBe(worktreeName);
        });
    });

    describe('Repository Metadata 持久化', () => {
        it('success_when_metadata_persisted_after_worktree_creation', async () => {
            const repo = await createRepository(client, `metadata-persist-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const fs = await import('fs/promises');
            const repoPath = path.join(config.repositoriesRoot, repo.id);

            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
            execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

            const worktreeName = 'persist-branch';
            const canvasId = await getCanvasId(client);
            const createResponse = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName}
            );

            expect(createResponse.success).toBe(true);

            const metadataPath = path.join(config.repositoriesRoot, '.metadata.json');
            const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
            expect(metadataExists).toBe(true);

            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            const worktreeRepoId = createResponse.repository!.id;
            expect(metadata[worktreeRepoId]).toBeDefined();
            expect(metadata[worktreeRepoId].parentRepoId).toBe(repo.id);
            expect(metadata[worktreeRepoId].branchName).toBe(worktreeName);
        });

        it('success_when_metadata_loaded_after_restart', async () => {
            const repo = await createRepository(client, `metadata-restart-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const repoPath = path.join(config.repositoriesRoot, repo.id);

            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
            execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

            const worktreeName = 'restart-branch';
            const canvasId = await getCanvasId(client);
            const createResponse = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName}
            );

            expect(createResponse.success).toBe(true);
            const worktreeRepoId = createResponse.repository!.id;

            const { repositoryService } = await import('../../src/services/repositoryService.js');
            await repositoryService.initialize();

            const metadata = repositoryService.getMetadata(worktreeRepoId);
            expect(metadata).toBeDefined();
            expect(metadata!.parentRepoId).toBe(repo.id);
            expect(metadata!.branchName).toBe(worktreeName);
        });

        it('success_when_metadata_removed_after_repository_deletion', async () => {
            const repo = await createRepository(client, `metadata-delete-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const fs = await import('fs/promises');
            const repoPath = path.join(config.repositoriesRoot, repo.id);

            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
            execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

            const worktreeName = 'delete-branch';
            const canvasId = await getCanvasId(client);
            const createResponse = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName}
            );

            expect(createResponse.success).toBe(true);
            const worktreeRepoId = createResponse.repository!.id;

            const deleteResponse = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), canvasId, repositoryId: worktreeRepoId}
            );

            expect(deleteResponse.success).toBe(true);

            const metadataPath = path.join(config.repositoriesRoot, '.metadata.json');
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            expect(metadata[worktreeRepoId]).toBeUndefined();
        });
    });

    describe('Repository Worktree 刪除', () => {
        it('success_when_worktree_repository_deleted_with_cleanup', async () => {
            const repo = await createRepository(client, `worktree-cleanup-${uuidv4()}`);

            const { config } = await import('../../src/config/index.js');
            const { execSync } = await import('child_process');
            const path = await import('path');
            const repoPath = path.join(config.repositoriesRoot, repo.id);

            execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
            execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

            const worktreeName = 'cleanup-branch';
            const canvasId = await getCanvasId(client);
            const createResponse = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                {requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName}
            );

            expect(createResponse.success).toBe(true);

            const worktreeRepoId = createResponse.repository!.id;
            const deleteResponse = await emitAndWaitResponse<RepositoryDeletePayload, RepositoryDeletedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_DELETE,
                WebSocketResponseEvents.REPOSITORY_DELETED,
                {requestId: uuidv4(), canvasId, repositoryId: worktreeRepoId}
            );

            expect(deleteResponse.success).toBe(true);

            const branches = execSync(`git -C "${repoPath}" branch`, { encoding: 'utf-8' });
            expect(branches).not.toContain(worktreeName);

            const worktreeList = execSync(`git -C "${repoPath}" worktree list`, { encoding: 'utf-8' });
            expect(worktreeList).not.toContain(worktreeRepoId);
        });
    });
});
