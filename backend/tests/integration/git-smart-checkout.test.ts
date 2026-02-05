import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { gitService } from '../../src/services/workspace/gitService.js';
import { config } from '../../src/config';

describe('Git 智慧分支切換', () => {
  const testRepoId = `test-smart-checkout-${uuidv4()}`;
  const testRepoPath = path.join(config.repositoriesRoot, testRepoId);
  const remoteRepoId = `test-remote-${uuidv4()}`;
  const remoteRepoPath = path.join(config.repositoriesRoot, remoteRepoId);

  beforeAll(async () => {
    // 建立一個模擬的遠端 repo
    await fs.mkdir(remoteRepoPath, { recursive: true });
    execSync(`git init --bare "${remoteRepoPath}"`, { encoding: 'utf-8' });

    // 建立本地 repo 並連接到遠端
    await fs.mkdir(testRepoPath, { recursive: true });
    execSync(`git init "${testRepoPath}"`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" config user.email "test@example.com"`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" config user.name "Test User"`, { encoding: 'utf-8' });

    // 建立初始 commit
    execSync(`echo "test" > "${testRepoPath}/README.md"`, { encoding: 'utf-8', shell: '/bin/bash' });
    execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" commit -m "Initial commit"`, { encoding: 'utf-8' });

    // 設定 remote 並推送
    execSync(`git -C "${testRepoPath}" remote add origin "${remoteRepoPath}"`, { encoding: 'utf-8' });
    execSync(`git -C "${testRepoPath}" push -u origin main || git -C "${testRepoPath}" push -u origin master`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  });

  afterAll(async () => {
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch {}
    try {
      await fs.rm(remoteRepoPath, { recursive: true, force: true });
    } catch {}
  });

  describe('smartCheckoutBranch - 本地分支存在', () => {
    it('success_when_local_branch_exists_switch_directly', async () => {
      const branchName = `local-branch-${uuidv4()}`;

      // 建立本地分支
      execSync(`git -C "${testRepoPath}" checkout -b "${branchName}"`, { encoding: 'utf-8' });
      // 切回主分支
      execSync(`git -C "${testRepoPath}" checkout main || git -C "${testRepoPath}" checkout master`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

      expect(result.success).toBe(true);
      expect(result.data).toBe('switched');

      // 驗證確實切換到該分支
      const currentBranch = await gitService.getCurrentBranch(testRepoPath);
      expect(currentBranch.success).toBe(true);
      expect(currentBranch.data).toBe(branchName);
    });

    it('success_when_local_branch_exists_with_force', async () => {
      const branchName = `local-branch-with-changes-${uuidv4()}`;

      // 建立本地分支並修改檔案
      execSync(`git -C "${testRepoPath}" checkout -b "${branchName}"`, { encoding: 'utf-8' });
      execSync(`echo "branch content" > "${testRepoPath}/README.md"`, {
        encoding: 'utf-8',
        shell: '/bin/bash'
      });
      execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
      execSync(`git -C "${testRepoPath}" commit -m "Update README"`, { encoding: 'utf-8' });

      // 切回主分支並修改同一個檔案
      execSync(`git -C "${testRepoPath}" checkout main || git -C "${testRepoPath}" checkout master`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      execSync(`echo "main content" > "${testRepoPath}/README.md"`, {
        encoding: 'utf-8',
        shell: '/bin/bash'
      });

      // 不使用 force 應該失敗
      const resultWithoutForce = await gitService.smartCheckoutBranch(testRepoPath, branchName, false);
      expect(resultWithoutForce.success).toBe(false);

      // 使用 force 應該成功
      const resultWithForce = await gitService.smartCheckoutBranch(testRepoPath, branchName, true);
      expect(resultWithForce.success).toBe(true);
      expect(resultWithForce.data).toBe('switched');
    });
  });

  describe('smartCheckoutBranch - 遠端分支存在', () => {
    it('success_when_remote_branch_exists_fetch_and_checkout', async () => {
      const branchName = `remote-branch-${uuidv4()}`;

      // 在遠端建立分支
      execSync(`git -C "${testRepoPath}" checkout -b "${branchName}"`, { encoding: 'utf-8' });
      execSync(`echo "remote content" > "${testRepoPath}/remote.txt"`, {
        encoding: 'utf-8',
        shell: '/bin/bash'
      });
      execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
      execSync(`git -C "${testRepoPath}" commit -m "Remote branch commit"`, { encoding: 'utf-8' });
      execSync(`git -C "${testRepoPath}" push origin "${branchName}"`, { encoding: 'utf-8' });

      // 刪除本地分支（但保留在遠端）
      execSync(`git -C "${testRepoPath}" checkout main || git -C "${testRepoPath}" checkout master`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });

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

  describe('smartCheckoutBranch - 分支不存在', () => {
    it('success_when_branch_not_exists_create_new', async () => {
      const branchName = `new-branch-${uuidv4()}`;

      // 確保回到主分支
      execSync(`git -C "${testRepoPath}" checkout main || git -C "${testRepoPath}" checkout master`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

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

  describe('smartCheckoutBranch - 錯誤處理', () => {
    it('failed_when_invalid_branch_name', async () => {
      const invalidBranchName = 'invalid//branch';

      const result = await gitService.smartCheckoutBranch(testRepoPath, invalidBranchName);

      expect(result.success).toBe(false);
      expect(result.error).toBe('無效的分支名稱格式');
    });

    it('failed_when_branch_is_used_by_worktree', async () => {
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
