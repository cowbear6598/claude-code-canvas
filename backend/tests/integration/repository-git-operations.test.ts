import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { $ } from 'bun';
import type { TestWebSocketClient } from '../setup';
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
    type RepositoryPullLatestPayload,
} from '../../src/schemas';
import {
    type RepositoryLocalBranchesResultPayload,
    type RepositoryWorktreeCreatedPayload,
    type RepositoryPullLatestResultPayload,
} from '../../src/types';

describe('Repository Git 操作', () => {
    describe('取得本地分支', () => {
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

        async function initGitRepoForWebSocket(repoId: string): Promise<string> {
            const { config } = await import('../../src/config/index.js');
            const repoPath = path.join(config.repositoriesRoot, repoId);

            await $`git init ${repoPath}`.quiet();
            await $`git -C ${repoPath} config user.email "test@example.com"`.quiet();
            await $`git -C ${repoPath} config user.name "Test User"`.quiet();
            await $`echo "test" > ${repoPath}/README.md`.quiet();
            await $`git -C ${repoPath} add .`.quiet();
            await $`git -C ${repoPath} commit -m "Initial commit"`.quiet();

            return repoPath;
        }

        it('無 worktree 時取得分支', async () => {
            const repo = await createRepository(client, `branches-no-wt-${uuidv4()}`);
            await initGitRepoForWebSocket(repo.id);

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

        it('有 worktree 時取得分支', async () => {
            const repo = await createRepository(client, `branches-with-wt-${uuidv4()}`);
            await initGitRepoForWebSocket(repo.id);

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

        it('多個 worktree', async () => {
            const repo = await createRepository(client, `branches-multi-wt-${uuidv4()}`);
            await initGitRepoForWebSocket(repo.id);

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

        it('不存在的 repository 失敗', async () => {
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

        it('非 git repository 失敗', async () => {
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

    describe('Pull 至最新版本', () => {
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

        it('不存在的 repository 回傳失敗', async () => {
            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryPullLatestPayload, RepositoryPullLatestResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_PULL_LATEST,
                WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: 'fake-repo-id' }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到 Repository');
        });

        it('非 git repository 回傳失敗', async () => {
            const repo = await createRepository(client, `pull-non-git-${uuidv4()}`);

            const canvasId = await getCanvasId(client);
            const response = await emitAndWaitResponse<RepositoryPullLatestPayload, RepositoryPullLatestResultPayload>(
                client,
                WebSocketRequestEvents.REPOSITORY_PULL_LATEST,
                WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
                { requestId: uuidv4(), canvasId, repositoryId: repo.id }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('不是 Git Repository');
        });
    });
});
