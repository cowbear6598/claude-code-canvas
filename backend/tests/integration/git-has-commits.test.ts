import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { gitService } from '../../src/services/workspace/gitService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import os from 'os';

describe('Git 服務 - 檢查是否有 Commit', () => {
    let testRoot: string;

    beforeAll(async () => {
        testRoot = path.join(os.tmpdir(), `git-test-${Date.now()}`);
        await fs.mkdir(testRoot, { recursive: true });
    });

    afterAll(async () => {
        await fs.rm(testRoot, { recursive: true, force: true });
    });

    it('success_when_repository_has_commits', async () => {
        const repoPath = path.join(testRoot, 'repo-with-commits');
        await fs.mkdir(repoPath, { recursive: true });

        execSync('git init', { cwd: repoPath });
        execSync('git config user.email "test@example.com"', { cwd: repoPath });
        execSync('git config user.name "Test User"', { cwd: repoPath });

        await fs.writeFile(path.join(repoPath, 'README.md'), '# Test');
        execSync('git add .', { cwd: repoPath });
        execSync('git commit -m "Initial commit"', { cwd: repoPath });

        const result = await gitService.hasCommits(repoPath);

        expect(result.success).toBe(true);
        expect(result.data).toBe(true);
    });

    it('success_when_repository_without_commits', async () => {
        const repoPath = path.join(testRoot, 'repo-without-commits');
        await fs.mkdir(repoPath, { recursive: true });

        execSync('git init', { cwd: repoPath });

        const result = await gitService.hasCommits(repoPath);

        expect(result.success).toBe(true);
        expect(result.data).toBe(false);
    });

    it('success_when_non_git_repository', async () => {
        const repoPath = path.join(testRoot, 'non-git-repo');
        await fs.mkdir(repoPath, { recursive: true });

        const result = await gitService.hasCommits(repoPath);

        expect(result.success).toBe(true);
        expect(result.data).toBe(false);
    });
});
