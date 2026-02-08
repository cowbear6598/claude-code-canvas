import { gitService } from '../../src/services/workspace/gitService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../src/config';
import { initGitRepo, initGitRepoWithRemote, cleanupRepo } from '../helpers/gitTestHelper.js';

describe('Git 操作', () => {
  describe('檢查是否有 Commit', () => {
    let testRoot: string;

    beforeAll(async () => {
      testRoot = path.join(os.tmpdir(), `git-test-${Date.now()}`);
      await fs.mkdir(testRoot, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(testRoot, { recursive: true, force: true });
    });

    it('有 commit 的 repo 回傳 true', async () => {
      const repoPath = path.join(testRoot, 'repo-with-commits');
      await fs.mkdir(repoPath, { recursive: true });

      await initGitRepo(repoPath);

      const result = await gitService.hasCommits(repoPath);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('沒有 commit 的 repo 回傳 false', async () => {
      const repoPath = path.join(testRoot, 'repo-without-commits');
      await fs.mkdir(repoPath, { recursive: true });

      const { $ } = await import('bun');
      await $`git init ${repoPath}`.quiet();

      const result = await gitService.hasCommits(repoPath);

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('非 git repo 回傳 false', async () => {
      const repoPath = path.join(testRoot, 'non-git-repo');
      await fs.mkdir(repoPath, { recursive: true });

      const result = await gitService.hasCommits(repoPath);

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('Worktree 操作', () => {
    const testRepoId = `test-worktree-repo-${uuidv4()}`;
    const testRepoPath = path.join(config.repositoriesRoot, testRepoId);
    const testWorktreeId = `${testRepoId}-feature`;
    const testWorktreePath = path.join(config.repositoriesRoot, testWorktreeId);

    beforeAll(async () => {
      await fs.mkdir(testRepoPath, { recursive: true });
      await initGitRepo(testRepoPath);
    });

    afterAll(async () => {
      await cleanupRepo(testRepoPath);
      await cleanupRepo(testWorktreePath);
    });

    describe('移除 Worktree', () => {
      it('成功移除', async () => {
        const branchName = `branch-${uuidv4()}`;
        const worktreePath = `${testWorktreePath}-${uuidv4()}`;

        await gitService.createWorktree(testRepoPath, worktreePath, branchName);

        const result = await gitService.removeWorktree(testRepoPath, worktreePath);

        expect(result.success).toBe(true);

        try {
          await fs.access(worktreePath);
          expect.unreachable('Worktree 目錄應該被移除');
        } catch {
          // 預期會失敗
        }
      });

      it('無效路徑失敗', async () => {
        const invalidPath = path.join(config.repositoriesRoot, `invalid-worktree-${uuidv4()}`);

        const result = await gitService.removeWorktree(testRepoPath, invalidPath);

        expect(result.success).toBe(false);
        expect(result.error).toBe('移除 Worktree 失敗');
      });
    });

    describe('刪除分支', () => {
      it('成功刪除', async () => {
        const branchName = `delete-branch-${uuidv4()}`;
        const { $ } = await import('bun');
        await $`git -C ${testRepoPath} branch ${branchName}`.quiet();

        const result = await gitService.deleteBranch(testRepoPath, branchName);

        expect(result.success).toBe(true);

        const branches = await $`git -C ${testRepoPath} branch`.text();
        expect(branches).not.toContain(branchName);
      });

      it('不存在失敗', async () => {
        const nonExistentBranch = `non-existent-${uuidv4()}`;

        const result = await gitService.deleteBranch(testRepoPath, nonExistentBranch);

        expect(result.success).toBe(false);
        expect(result.error).toBe('刪除分支失敗');
      });
    });

    describe('取得 Worktree 分支', () => {
      it('取得 worktree 分支', async () => {
        const branchName = `worktree-branch-${uuidv4()}`;
        const worktreePath = `${testWorktreePath}-${uuidv4()}`;

        await gitService.createWorktree(testRepoPath, worktreePath, branchName);

        const result = await gitService.getWorktreeBranches(testRepoPath);

        expect(result.success).toBe(true);
        expect(result.data).toContain(branchName);

        await gitService.removeWorktree(testRepoPath, worktreePath);
      });

      it('無 worktree 時為空', async () => {
        const emptyRepoId = `empty-repo-${uuidv4()}`;
        const emptyRepoPath = path.join(config.repositoriesRoot, emptyRepoId);

        await fs.mkdir(emptyRepoPath, { recursive: true });
        await initGitRepo(emptyRepoPath);

        const result = await gitService.getWorktreeBranches(emptyRepoPath);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(0);

        await cleanupRepo(emptyRepoPath);
      });

      it('排除主 repo 的分支', async () => {
        const branchName1 = `worktree-branch-${uuidv4()}`;
        const branchName2 = `worktree-branch-${uuidv4()}`;
        const worktreePath1 = `${testWorktreePath}-${uuidv4()}`;
        const worktreePath2 = `${testWorktreePath}-${uuidv4()}`;

        await gitService.createWorktree(testRepoPath, worktreePath1, branchName1);
        await gitService.createWorktree(testRepoPath, worktreePath2, branchName2);

        const result = await gitService.getWorktreeBranches(testRepoPath);

        expect(result.success).toBe(true);
        expect(result.data).toContain(branchName1);
        expect(result.data).toContain(branchName2);
        // 確認主 repo 的分支（main 或 master）不在 worktree 分支列表中
        const currentBranchResult = await gitService.getCurrentBranch(testRepoPath);
        if (currentBranchResult.success && currentBranchResult.data) {
          expect(result.data).not.toContain(currentBranchResult.data);
        }

        await gitService.removeWorktree(testRepoPath, worktreePath1);
        await gitService.removeWorktree(testRepoPath, worktreePath2);
      });
    });

    describe('取得本地分支（含 Worktree 資訊）', () => {
      it('有 worktree 時', async () => {
        const branchName = `feature-${uuidv4()}`;
        const worktreePath = `${testWorktreePath}-${uuidv4()}`;

        await gitService.createWorktree(testRepoPath, worktreePath, branchName);

        const result = await gitService.getLocalBranches(testRepoPath);

        expect(result.success).toBe(true);
        expect(result.data!.branches).toContain(branchName);
        expect(result.data!.worktreeBranches).toContain(branchName);

        await gitService.removeWorktree(testRepoPath, worktreePath);
      });

      it('無 worktree 時', async () => {
        const result = await gitService.getLocalBranches(testRepoPath);

        expect(result.success).toBe(true);
        expect(result.data!.branches).toBeDefined();
        expect(result.data!.current).toBeDefined();
        expect(result.data!.worktreeBranches).toBeDefined();
      });
    });
  });

  describe('智慧分支切換', () => {
    const testRepoId = `test-smart-checkout-${uuidv4()}`;
    const testRepoPath = path.join(config.repositoriesRoot, testRepoId);
    const remoteRepoId = `test-remote-${uuidv4()}`;
    const remoteRepoPath = path.join(config.repositoriesRoot, remoteRepoId);

    beforeAll(async () => {
      await fs.mkdir(remoteRepoPath, { recursive: true });
      await fs.mkdir(testRepoPath, { recursive: true });
      await initGitRepoWithRemote(testRepoPath, remoteRepoPath);
    });

    afterAll(async () => {
      await cleanupRepo(testRepoPath);
      await cleanupRepo(remoteRepoPath);
    });

    describe('本地分支存在', () => {
      it('直接切換成功', async () => {
        const branchName = `local-branch-${uuidv4()}`;
        const { $ } = await import('bun');

        // 建立本地分支
        await $`git -C ${testRepoPath} checkout -b ${branchName}`.quiet();
        // 切回主分支
        await $`git -C ${testRepoPath} checkout main || git -C ${testRepoPath} checkout master`.quiet();

        const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

        expect(result.success).toBe(true);
        expect(result.data).toBe('switched');

        // 驗證確實切換到該分支
        const currentBranch = await gitService.getCurrentBranch(testRepoPath);
        expect(currentBranch.success).toBe(true);
        expect(currentBranch.data).toBe(branchName);
      });

      it('使用 force 成功', async () => {
        const branchName = `local-branch-with-changes-${uuidv4()}`;
        const { $ } = await import('bun');

        // 建立本地分支並修改檔案
        await $`git -C ${testRepoPath} checkout -b ${branchName}`.quiet();
        await $`echo "branch content" > ${testRepoPath}/README.md`.quiet();
        await $`git -C ${testRepoPath} add .`.quiet();
        await $`git -C ${testRepoPath} commit -m "Update README"`.quiet();

        // 切回主分支並修改同一個檔案
        await $`git -C ${testRepoPath} checkout main || git -C ${testRepoPath} checkout master`.quiet();
        await $`echo "main content" > ${testRepoPath}/README.md`.quiet();

        // 不使用 force 應該失敗
        const resultWithoutForce = await gitService.smartCheckoutBranch(testRepoPath, branchName, false);
        expect(resultWithoutForce.success).toBe(false);

        // 使用 force 應該成功
        const resultWithForce = await gitService.smartCheckoutBranch(testRepoPath, branchName, true);
        expect(resultWithForce.success).toBe(true);
        expect(resultWithForce.data).toBe('switched');
      });
    });

    describe('遠端分支存在', () => {
      it('fetch 並切換成功', async () => {
        const branchName = `remote-branch-${uuidv4()}`;
        const { $ } = await import('bun');

        // 在遠端建立分支
        await $`git -C ${testRepoPath} checkout -b ${branchName}`.quiet();
        await $`echo "remote content" > ${testRepoPath}/remote.txt`.quiet();
        await $`git -C ${testRepoPath} add .`.quiet();
        await $`git -C ${testRepoPath} commit -m "Remote branch commit"`.quiet();
        await $`git -C ${testRepoPath} push origin ${branchName}`.quiet();

        // 刪除本地分支（但保留在遠端）
        await $`git -C ${testRepoPath} checkout main || git -C ${testRepoPath} checkout master`.quiet();
        await $`git -C ${testRepoPath} branch -D ${branchName}`.quiet();

        const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

        expect(result.success).toBe(true);
        expect(result.data).toBe('fetched');

        // 驗證確實切換到該分支
        const currentBranch = await gitService.getCurrentBranch(testRepoPath);
        expect(currentBranch.success).toBe(true);
        expect(currentBranch.data).toBe(branchName);

        // 驗證檔案存在（確認真的 fetch 了遠端內容）
        const fileExists = await fs.access(path.join(testRepoPath, 'remote.txt'))
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      });
    });

    describe('分支不存在', () => {
      it('建立新分支成功', async () => {
        const branchName = `new-branch-${uuidv4()}`;
        const { $ } = await import('bun');

        // 確保回到主分支
        await $`git -C ${testRepoPath} checkout main || git -C ${testRepoPath} checkout master`.quiet();

        const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

        expect(result.success).toBe(true);
        expect(result.data).toBe('created');

        // 驗證確實切換到該分支
        const currentBranch = await gitService.getCurrentBranch(testRepoPath);
        expect(currentBranch.success).toBe(true);
        expect(currentBranch.data).toBe(branchName);

        // 驗證分支存在
        const branchExists = await gitService.branchExists(testRepoPath, branchName);
        expect(branchExists.success).toBe(true);
        expect(branchExists.data).toBe(true);
      });
    });

    describe('錯誤處理', () => {
      it('無效分支名失敗', async () => {
        const invalidBranchName = 'invalid//branch';

        const result = await gitService.smartCheckoutBranch(testRepoPath, invalidBranchName);

        expect(result.success).toBe(false);
        expect(result.error).toBe('無效的分支名稱格式');
      });

      it('分支被 worktree 使用失敗', async () => {
        const branchName = `worktree-branch-${uuidv4()}`;
        const worktreePath = path.join(config.repositoriesRoot, `worktree-${uuidv4()}`);

        // 建立 worktree
        await gitService.createWorktree(testRepoPath, worktreePath, branchName);

        // 嘗試切換到被 worktree 使用的分支
        const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

        expect(result.success).toBe(false);
        expect(result.error).toContain('該分支已被 Worktree 使用');

        // 清理
        await gitService.removeWorktree(testRepoPath, worktreePath);
      });
    });
  });
});
