import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';

describe('Repository 智慧分支切換', () => {
    const testRepoId = `test-repo-checkout-${uuidv4()}`;
    let testRepoPath: string;
    let config: any;

    beforeAll(async () => {
        const configModule = await import('../../src/config/index.js');
        config = configModule.config;
        testRepoPath = path.join(config.repositoriesRoot, testRepoId);

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
        } catch (error) {
            console.error('Failed to cleanup test repository:', error);
        }
    });

    describe('檢查遠端分支是否存在', () => {
        it('success_when_remote_branch_exists', async () => {
            const branchName = 'test-remote-branch';
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });

            execSync(`git -C "${testRepoPath}" config --add remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.checkRemoteBranchExists(testRepoPath, branchName);

            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });

            expect(result.success).toBe(true);
        });

        it('success_when_remote_branch_not_exists', async () => {
            const nonExistentBranch = `non-existent-${uuidv4()}`;

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.checkRemoteBranchExists(testRepoPath, nonExistentBranch);

            expect(result.success).toBe(true);
            expect(result.data).toBe(false);
        });
    });

    describe('建立並切換到新分支', () => {
        it('success_when_create_new_branch', async () => {
            const newBranchName = `new-branch-${uuidv4()}`;

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.createAndCheckoutBranch(testRepoPath, newBranchName);

            expect(result.success).toBe(true);

            const currentBranch = execSync(`git -C "${testRepoPath}" branch --show-current`, { encoding: 'utf-8' }).trim();
            expect(currentBranch).toBe(newBranchName);

            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${newBranchName}"`, { encoding: 'utf-8' });
        });

        it('failed_when_branch_name_invalid', async () => {
            const invalidBranchName = 'invalid branch name';

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.createAndCheckoutBranch(testRepoPath, invalidBranchName);

            expect(result.success).toBe(false);
            expect(result.error).toBe('無效的分支名稱格式');
        });
    });

    describe('智慧切換分支', () => {
        it('success_when_switch_to_existing_local_branch', async () => {
            const branchName = `local-branch-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.smartCheckoutBranch(testRepoPath, branchName);

            expect(result.success).toBe(true);
            expect(result.data).toBe('switched');

            const currentBranch = execSync(`git -C "${testRepoPath}" branch --show-current`, { encoding: 'utf-8' }).trim();
            expect(currentBranch).toBe(branchName);

            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });
        });

        it('success_when_create_new_branch_if_not_exists', async () => {
            const newBranchName = `created-branch-${uuidv4()}`;

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.smartCheckoutBranch(testRepoPath, newBranchName);

            expect(result.success).toBe(true);
            expect(result.data).toBe('created');

            const currentBranch = execSync(`git -C "${testRepoPath}" branch --show-current`, { encoding: 'utf-8' }).trim();
            expect(currentBranch).toBe(newBranchName);

            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${newBranchName}"`, { encoding: 'utf-8' });
        });

        it('failed_when_branch_name_invalid', async () => {
            const invalidBranchName = 'invalid branch name';

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.smartCheckoutBranch(testRepoPath, invalidBranchName);

            expect(result.success).toBe(false);
            expect(result.error).toBe('無效的分支名稱格式');
        });

        it('success_when_force_checkout_with_uncommitted_changes', async () => {
            const branchName = `force-branch-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });
            execSync(`echo "uncommitted" > "${testRepoPath}/test.txt"`, { encoding: 'utf-8', shell: '/bin/bash' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.smartCheckoutBranch(testRepoPath, branchName, true);

            expect(result.success).toBe(true);
            expect(result.data).toBe('switched');

            const currentBranch = execSync(`git -C "${testRepoPath}" branch --show-current`, { encoding: 'utf-8' }).trim();
            expect(currentBranch).toBe(branchName);

            execSync(`git -C "${testRepoPath}" checkout master --force`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });
        });
    });
});
