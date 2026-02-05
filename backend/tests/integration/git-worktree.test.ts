import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { gitService } from '../../src/services/workspace/gitService.js';
import { config } from '../../src/config/index.js';

describe('Git Worktree 操作', () => {
  const testRepoId = `test-worktree-repo-${uuidv4()}`;
  const testRepoPath = path.join(config.repositoriesRoot, testRepoId);
  const testWorktreeId = `${testRepoId}-feature`;
  const testWorktreePath = path.join(config.repositoriesRoot, testWorktreeId);

  beforeAll(async () => {
    await fs.mkdir(testRepoPath, { recursive: true });
    execSync(`git init "${testRepoPath}"`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
    execSync(`echo "test" > "${testRepoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
    execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });
  });

  afterAll(async () => {
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch {}
    try {
      await fs.rm(testWorktreePath, { recursive: true, force: true });
    } catch {}
  });

  describe('移除 Worktree', () => {
    it('success_when_remove_worktree', async () => {
      const branchName = `branch-${uuidv4()}`;
      const worktreePath = `${testWorktreePath}-${uuidv4()}`;

      await gitService.createWorktree(testRepoPath, worktreePath, branchName);

      const result = await gitService.removeWorktree(testRepoPath, worktreePath);

      expect(result.success).toBe(true);

      try {
        await fs.access(worktreePath);
        expect.fail('Worktree 目錄應該被移除');
      } catch {
        // 預期會失敗
      }
    });

    it('failed_when_remove_worktree_with_invalid_path', async () => {
      const invalidPath = path.join(config.repositoriesRoot, `invalid-worktree-${uuidv4()}`);

      const result = await gitService.removeWorktree(testRepoPath, invalidPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('移除 Worktree 失敗');
    });
  });

  describe('刪除分支', () => {
    it('success_when_delete_branch', async () => {
      const branchName = `delete-branch-${uuidv4()}`;
      execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });

      const result = await gitService.deleteBranch(testRepoPath, branchName);

      expect(result.success).toBe(true);

      const branches = execSync(`git -C "${testRepoPath}" branch`, { encoding: 'utf-8' });
      expect(branches).not.toContain(branchName);
    });

    it('failed_when_delete_branch_not_exist', async () => {
      const nonExistentBranch = `non-existent-${uuidv4()}`;

      const result = await gitService.deleteBranch(testRepoPath, nonExistentBranch);

      expect(result.success).toBe(false);
      expect(result.error).toBe('刪除分支失敗');
    });
  });

  describe('取得 Worktree 分支', () => {
    it('success_when_get_worktree_branches', async () => {
      const branchName = `worktree-branch-${uuidv4()}`;
      const worktreePath = `${testWorktreePath}-${uuidv4()}`;

      await gitService.createWorktree(testRepoPath, worktreePath, branchName);

      const result = await gitService.getWorktreeBranches(testRepoPath);

      expect(result.success).toBe(true);
      expect(result.data).toContain(branchName);

      await gitService.removeWorktree(testRepoPath, worktreePath);
    });

    it('success_when_no_worktrees', async () => {
      const emptyRepoId = `empty-repo-${uuidv4()}`;
      const emptyRepoPath = path.join(config.repositoriesRoot, emptyRepoId);

      await fs.mkdir(emptyRepoPath, { recursive: true });
      execSync(`git init "${emptyRepoPath}"`, { encoding: 'utf-8' });
      execSync(`git -C "${emptyRepoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
      execSync(`git -C "${emptyRepoPath}" config user.name "Test User"`, { encoding: 'utf-8' });
      execSync(`echo "test" > "${emptyRepoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
      execSync(`git -C "${emptyRepoPath}" add .`, { encoding: 'utf-8' });
      execSync(`git -C "${emptyRepoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

      const result = await gitService.getWorktreeBranches(emptyRepoPath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);

      await fs.rm(emptyRepoPath, { recursive: true, force: true });
    });

    it('success_when_exclude_main_repo_path', async () => {
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

  describe('取得本地分支（包含 Worktree 資訊）', () => {
    it('success_when_get_local_branches_with_worktree', async () => {
      const branchName = `feature-${uuidv4()}`;
      const worktreePath = `${testWorktreePath}-${uuidv4()}`;

      await gitService.createWorktree(testRepoPath, worktreePath, branchName);

      const result = await gitService.getLocalBranches(testRepoPath);

      expect(result.success).toBe(true);
      expect(result.data!.branches).toContain(branchName);
      expect(result.data!.worktreeBranches).toContain(branchName);

      await gitService.removeWorktree(testRepoPath, worktreePath);
    });

    it('success_when_get_local_branches_without_worktree', async () => {
      const result = await gitService.getLocalBranches(testRepoPath);

      expect(result.success).toBe(true);
      expect(result.data!.branches).toBeDefined();
      expect(result.data!.current).toBeDefined();
      expect(result.data!.worktreeBranches).toBeDefined();
    });
  });
});
