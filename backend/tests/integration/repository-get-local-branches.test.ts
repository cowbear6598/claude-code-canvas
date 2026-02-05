import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import {
    closeTestServer,
    createSocketClient,
    createTestServer,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance,
} from '../setup';
import { createRepository, getCanvasId } from '../helpers';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type RepositoryGetLocalBranchesPayload,
    type RepositoryWorktreeCreatePayload,
} from '../../src/schemas';
import {
    type RepositoryLocalBranchesResultPayload,
    type RepositoryWorktreeCreatedPayload,
} from '../../src/types';

describe('Repository 取得本地分支', () => {
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

    async function initGitRepo(repoId: string): Promise<string> {
        const { config } = await import('../../src/config/index.js');
        const { execSync } = await import('child_process');
        const path = await import('path');
        const repoPath = path.join(config.repositoriesRoot, repoId);

        execSync(`git init "${repoPath}"`, { encoding: 'utf-8' });
        execSync(`git -C "${repoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
        execSync(`git -C "${repoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
        execSync(`echo "test" > "${repoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
        execSync(`git -C "${repoPath}" add .`, { encoding: 'utf-8' });
        execSync(`git -C "${repoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

        return repoPath;
    }

    describe('取得本地分支列表', () => {
        it('success_when_get_local_branches_without_worktree', async () => {
            const repo = await createRepository(client, `branches-no-wt-${uuidv4()}`);
            await initGitRepo(repo.id);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
                WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id }
            );

            expect(response.success).toBe(true);
            expect(response.branches).toBeDefined();
            expect(response.currentBranch).toBeDefined();
            expect(response.worktreeBranches).toBeDefined();
            expect(Array.isArray(response.branches)).toBe(true);
            expect(Array.isArray(response.worktreeBranches)).toBe(true);
        });

        it('success_when_get_local_branches_with_worktree', async () => {
            const repo = await createRepository(client, `branches-with-wt-${uuidv4()}`);
            await initGitRepo(repo.id);

            const worktreeName = 'feature-branch';
            const canvasId = await getCanvasId(client);

            const createResponse = await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName }
            );

            expect(createResponse.success).toBe(true);

            const response = await emitAndWaitResponse<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
                WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id }
            );

            expect(response.success).toBe(true);
            expect(response.branches).toContain(worktreeName);
            expect(response.worktreeBranches).toContain(worktreeName);
        });

        it('success_when_get_local_branches_with_multiple_worktrees', async () => {
            const repo = await createRepository(client, `branches-multi-wt-${uuidv4()}`);
            await initGitRepo(repo.id);

            const worktreeName1 = 'feature-1';
            const worktreeName2 = 'feature-2';
            const canvasId = await getCanvasId(client);

            await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName: worktreeName1 }
            );

            await emitAndWaitResponse<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
                WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id, worktreeName: worktreeName2 }
            );

            const response = await emitAndWaitResponse<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
                WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id }
            );

            expect(response.success).toBe(true);
            expect(response.branches).toContain(worktreeName1);
            expect(response.branches).toContain(worktreeName2);
            expect(response.worktreeBranches).toContain(worktreeName1);
            expect(response.worktreeBranches).toContain(worktreeName2);
            expect(response.worktreeBranches!.length).toBe(2);
        });

        it('failed_when_get_local_branches_from_nonexistent_repository', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
                WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: 'fake-repo-id' }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到 Repository');
        });

        it('failed_when_get_local_branches_from_non_git_repository', async () => {
            const repo = await createRepository(client, `branches-non-git-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
                WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('不是 Git Repository');
        });
    });
});
