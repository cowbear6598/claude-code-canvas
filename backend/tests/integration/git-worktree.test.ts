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
  const testBranchName = 'feature-branch';

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
});
