import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { $ } from 'bun';
import fs from 'fs/promises';
import type { TestWebSocketClient } from '../setup/socketClient.js';
import {
    closeTestServer,
    createSocketClient,
    createTestServer,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance,
} from '../setup/index.js';
import { createRepository, getCanvasId } from '../helpers/index.js';
import { initGitRepo, cleanupRepo } from '../helpers/gitTestHelper.js';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type RepositoryGetLocalBranchesPayload,
    type RepositoryWorktreeCreatePayload,
} from '../../src/schemas/index.js';
import {
    type RepositoryLocalBranchesResultPayload,
    type RepositoryWorktreeCreatedPayload,
} from '../../src/types/index.js';

describe('Repository Git 操作', () => {
    describe('智慧分支切換', () => {
        const testRepoId = `test-repo-checkout-${uuidv4()}`;
        let testRepoPath: string;
        let config: any;

        beforeAll(async () => {
            const configModule = await import('../../src/config/index.js');
            config = configModule.config;
            testRepoPath = path.join(config.repositoriesRoot, testRepoId);

            await fs.mkdir(testRepoPath, { recursive: true });
            await initGitRepo(testRepoPath);
        });

        afterAll(async () => {
            await cleanupRepo(testRepoPath);
        });

        describe('檢查遠端分支', () => {
            it('不存在的遠端分支回傳 false', async () => {
                const nonExistentBranch = `non-existent-${uuidv4()}`;

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.checkRemoteBranchExists(testRepoPath, nonExistentBranch);

                expect(result.success).toBe(true);
                expect(result.data).toBe(false);
            });
        });

        describe('建立並切換到新分支', () => {
            it('成功建立新分支', async () => {
                const newBranchName = `new-branch-${uuidv4()}`;

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.createAndCheckoutBranch(testRepoPath, newBranchName);

                expect(result.success).toBe(true);

                const currentBranch = await $`git -C ${testRepoPath} branch --show-current`.text();
                expect(currentBranch.trim()).toBe(newBranchName);

                await $`git -C ${testRepoPath} checkout master`.quiet();
                await $`git -C ${testRepoPath} branch -D ${newBranchName}`.quiet();
            });

            it('無效分支名失敗', async () => {
                const invalidBranchName = 'invalid branch name';

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.createAndCheckoutBranch(testRepoPath, invalidBranchName);

                expect(result.success).toBe(false);
                expect(result.error).toBe('無效的分支名稱格式');
            });
        });

        describe('智慧切換', () => {
            it('切換到本地分支', async () => {
                const branchName = `local-branch-${uuidv4()}`;
                await $`git -C ${testRepoPath} branch ${branchName}`.quiet();

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

                expect(result.success).toBe(true);
                expect(result.data).toBe('switched');

                const currentBranch = await $`git -C ${testRepoPath} branch --show-current`.text();
                expect(currentBranch.trim()).toBe(branchName);

                await $`git -C ${testRepoPath} checkout master`.quiet();
                await $`git -C ${testRepoPath} branch -D ${branchName}`.quiet();
            });

            it('建立不存在的分支', async () => {
                const newBranchName = `created-branch-${uuidv4()}`;

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.smartCheckoutBranch(testRepoPath, newBranchName);

                expect(result.success).toBe(true);
                expect(result.data).toBe('created');

                const currentBranch = await $`git -C ${testRepoPath} branch --show-current`.text();
                expect(currentBranch.trim()).toBe(newBranchName);

                await $`git -C ${testRepoPath} checkout master`.quiet();
                await $`git -C ${testRepoPath} branch -D ${newBranchName}`.quiet();
            });

            it('無效分支名失敗', async () => {
                const invalidBranchName = 'invalid branch name';

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.smartCheckoutBranch(testRepoPath, invalidBranchName);

                expect(result.success).toBe(false);
                expect(result.error).toBe('無效的分支名稱格式');
            });

            it('force 切換', async () => {
                const branchName = `force-branch-${uuidv4()}`;
                await $`git -C ${testRepoPath} branch ${branchName}`.quiet();
                await $`echo "uncommitted" > ${testRepoPath}/test.txt`.quiet();

                const { gitService } = await import('../../src/services/workspace/gitService.js');
                const result = await gitService.smartCheckoutBranch(testRepoPath, branchName, true);

                expect(result.success).toBe(true);
                expect(result.data).toBe('switched');

                const currentBranch = await $`git -C ${testRepoPath} branch --show-current`.text();
                expect(currentBranch.trim()).toBe(branchName);

                await $`git -C ${testRepoPath} checkout master --force`.quiet();
                await $`git -C ${testRepoPath} branch -D ${branchName}`.quiet();
            });
        });
    });

    describe('刪除分支', () => {
        const testRepoId = `test-repo-delete-branch-${uuidv4()}`;
        let testRepoPath: string;
        let config: any;

        beforeAll(async () => {
            const configModule = await import('../../src/config/index.js');
            config = configModule.config;
            testRepoPath = path.join(config.repositoriesRoot, testRepoId);

            await fs.mkdir(testRepoPath, { recursive: true });
            await initGitRepo(testRepoPath);
        });

        afterAll(async () => {
            await cleanupRepo(testRepoPath);
        });

        it('成功刪除已合併分支', async () => {
            const branchName = `merged-branch-${uuidv4()}`;
            await $`git -C ${testRepoPath} branch ${branchName}`.quiet();

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(true);

            const branches = await $`git -C ${testRepoPath} branch`.text();
            expect(branches).not.toContain(branchName);
        });

        it('強制刪除未合併分支', async () => {
            const branchName = `unmerged-branch-${uuidv4()}`;
            await $`git -C ${testRepoPath} branch ${branchName}`.quiet();
            await $`git -C ${testRepoPath} checkout ${branchName}`.quiet();
            await $`echo "unmerged content" > ${testRepoPath}/unmerged.txt`.quiet();
            await $`git -C ${testRepoPath} add .`.quiet();
            await $`git -C ${testRepoPath} commit -m "Unmerged commit"`.quiet();
            await $`git -C ${testRepoPath} checkout master`.quiet();

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, true);

            expect(result.success).toBe(true);

            const branches = await $`git -C ${testRepoPath} branch`.text();
            expect(branches).not.toContain(branchName);
        });

        it('無法刪除目前所在分支', async () => {
            const branchName = `current-branch-${uuidv4()}`;
            await $`git -C ${testRepoPath} branch ${branchName}`.quiet();
            await $`git -C ${testRepoPath} checkout ${branchName}`.quiet();

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(false);
            expect(result.error).toBe('無法刪除目前所在的分支');

            await $`git -C ${testRepoPath} checkout master`.quiet();
            await $`git -C ${testRepoPath} branch -D ${branchName}`.quiet();
        });

        it('刪除不存在分支失敗', async () => {
            const nonExistentBranch = `non-existent-${uuidv4()}`;

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, nonExistentBranch, false);

            expect(result.success).toBe(false);
            expect(result.error).toBe('刪除分支失敗');
        });

        it('未合併分支不使用 force 失敗', async () => {
            const branchName = `unmerged-no-force-${uuidv4()}`;
            await $`git -C ${testRepoPath} branch ${branchName}`.quiet();
            await $`git -C ${testRepoPath} checkout ${branchName}`.quiet();
            await $`echo "unmerged content" > ${testRepoPath}/unmerged2.txt`.quiet();
            await $`git -C ${testRepoPath} add .`.quiet();
            await $`git -C ${testRepoPath} commit -m "Unmerged commit"`.quiet();
            await $`git -C ${testRepoPath} checkout master`.quiet();

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(false);
            expect(result.error).toContain('尚未合併，是否要強制刪除？');

            await $`git -C ${testRepoPath} branch -D ${branchName}`.quiet();
        });
    });

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
});
