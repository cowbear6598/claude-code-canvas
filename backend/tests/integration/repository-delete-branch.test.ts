import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';

describe('Repository 刪除分支', () => {
    const testRepoId = `test-repo-delete-branch-${uuidv4()}`;
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

    describe('刪除分支', () => {
        it('success_when_delete_merged_branch_without_force', async () => {
            const branchName = `merged-branch-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(true);

            const branches = execSync(`git -C "${testRepoPath}" branch`, { encoding: 'utf-8' });
            expect(branches).not.toContain(branchName);
        });

        it('success_when_force_delete_unmerged_branch', async () => {
            const branchName = `unmerged-branch-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout "${branchName}"`, { encoding: 'utf-8' });
            execSync(`echo "unmerged content" > "${testRepoPath}/unmerged.txt"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" commit -m "Unmerged commit"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, true);

            expect(result.success).toBe(true);

            const branches = execSync(`git -C "${testRepoPath}" branch`, { encoding: 'utf-8' });
            expect(branches).not.toContain(branchName);
        });

        it('failed_when_deleting_current_branch', async () => {
            const branchName = `current-branch-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout "${branchName}"`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(false);
            expect(result.error).toBe('無法刪除目前所在的分支');

            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });
        });

        it('failed_when_deleting_non_existent_branch', async () => {
            const nonExistentBranch = `non-existent-${uuidv4()}`;

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, nonExistentBranch, false);

            expect(result.success).toBe(false);
            expect(result.error).toBe('刪除分支失敗');
        });

        it('failed_when_delete_unmerged_branch_without_force', async () => {
            const branchName = `unmerged-no-force-${uuidv4()}`;
            execSync(`git -C "${testRepoPath}" branch "${branchName}"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout "${branchName}"`, { encoding: 'utf-8' });
            execSync(`echo "unmerged content" > "${testRepoPath}/unmerged2.txt"`, { encoding: 'utf-8', shell: '/bin/bash' });
            execSync(`git -C "${testRepoPath}" add .`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" commit -m "Unmerged commit"`, { encoding: 'utf-8' });
            execSync(`git -C "${testRepoPath}" checkout master`, { encoding: 'utf-8' });

            const { gitService } = await import('../../src/services/workspace/gitService.js');
            const result = await gitService.deleteBranch(testRepoPath, branchName, false);

            expect(result.success).toBe(false);
            expect(result.error).toContain('尚未合併，是否要強制刪除？');

            execSync(`git -C "${testRepoPath}" branch -D "${branchName}"`, { encoding: 'utf-8' });
        });
    });
});
