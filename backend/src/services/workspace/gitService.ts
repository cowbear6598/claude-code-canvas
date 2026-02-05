import {simpleGit, SimpleGitProgressEvent} from 'simple-git';
import {Result, ok, err} from '../../types';
import {config} from '../../config';
import {logger} from '../../utils/logger.js';
import {fileExists} from '../shared/fileResourceHelpers.js';
import {isPathWithinDirectory} from '../../utils/pathValidator.js';
import {gitOperation} from '../../utils/operationHelpers.js';
import path from 'path';

interface GitCloneProgress {
    stage: string;
    progress: number;
}

interface GitCloneOptions {
    branch?: string;
    onProgress?: (progress: GitCloneProgress) => void;
}

const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9_\-/]+$/;

function isValidBranchName(branchName: string): boolean {
    if (!BRANCH_NAME_PATTERN.test(branchName)) {
        return false;
    }
    if (branchName.includes('//')) {
        return false;
    }

    return !(branchName.startsWith('/') || branchName.endsWith('/'));
}

function parseGitErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getBranchDeletionError(errorMessage: string, branchName: string): string {
    if (errorMessage.includes('not fully merged')) {
        return `分支「${branchName}」尚未合併，是否要強制刪除？`;
    }
    return '刪除分支失敗';
}

function getCheckoutError(errorMessage: string, branchName: string): string {
    if (errorMessage.includes('is already checked out at')) {
        return `無法切換到分支「${branchName}」，該分支已被 Worktree 使用`;
    }
    return '切換分支失敗';
}

class GitService {
    async clone(
        repoUrl: string,
        targetPath: string,
        options?: GitCloneOptions
    ): Promise<Result<void>> {
        return gitOperation(async () => {
            const git = simpleGit({
                progress: options?.onProgress
                    ? (event: SimpleGitProgressEvent): void => {
                        const progressData: GitCloneProgress = {
                            stage: event.stage,
                            progress: event.progress,
                        };
                        options.onProgress!(progressData);
                    }
                    : undefined,
            });

            let authenticatedUrl = repoUrl;
            if (config.githubToken && repoUrl.includes('github.com')) {
                if (repoUrl.startsWith('https://github.com/')) {
                    authenticatedUrl = repoUrl.replace(
                        'https://github.com/',
                        `https://${config.githubToken}@github.com/`
                    );
                }
            }

            const cloneOptions = options?.branch ? ['--branch', options.branch] : [];
            await git.clone(authenticatedUrl, targetPath, cloneOptions);
        }, '複製儲存庫失敗');
    }

    async getCurrentBranch(workspacePath: string): Promise<Result<string>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const status = await git.status();
            return status.current || 'unknown';
        }, '取得目前分支失敗');
    }

    async isGitRepository(workspacePath: string): Promise<Result<boolean>> {
        const gitPath = path.join(workspacePath, '.git');
        const exists = await fileExists(gitPath);
        return ok(exists);
    }

    async hasCommits(workspacePath: string): Promise<Result<boolean>> {
        const result = await gitOperation(async () => {
            const git = simpleGit(workspacePath);
            await git.revparse(['HEAD']);
            return true;
        }, '檢查 commits 失敗');

        if (!result.success || result.data === undefined) {
            return ok(false);
        }
        return ok(result.data);
    }

    async branchExists(workspacePath: string, branchName: string): Promise<Result<boolean>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const branches = await git.branch();
            return branches.all.includes(branchName);
        }, '檢查分支失敗');
    }

    async createWorktree(workspacePath: string, worktreePath: string, branchName: string): Promise<Result<void>> {
        if (!isPathWithinDirectory(worktreePath, config.repositoriesRoot)) {
            return err('無效的 worktree 路徑');
        }

        if (!isValidBranchName(branchName)) {
            return err('無效的分支名稱格式');
        }

        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            await git.raw(['worktree', 'add', '-b', branchName, worktreePath]);
        }, '建立 Worktree 失敗');
    }

    async removeWorktree(parentRepoPath: string, worktreePath: string): Promise<Result<void>> {
        if (!isPathWithinDirectory(worktreePath, config.repositoriesRoot)) {
            return err('無效的 worktree 路徑');
        }

        return gitOperation(async () => {
            const git = simpleGit(parentRepoPath);
            await git.raw(['worktree', 'remove', worktreePath]);
        }, '移除 Worktree 失敗');
    }

    async deleteBranch(workspacePath: string, branchName: string, force?: boolean): Promise<Result<void>> {
        const currentBranchResult = await this.getCurrentBranch(workspacePath);
        if (!currentBranchResult.success) {
            return err(currentBranchResult.error!);
        }

        if (currentBranchResult.data === branchName) {
            return err('無法刪除目前所在的分支');
        }

        try {
            const git = simpleGit(workspacePath);
            const flag = force ? '-D' : '-d';
            await git.raw(['branch', flag, branchName]);
            return ok(undefined);
        } catch (error) {
            const errorMessage = parseGitErrorMessage(error);
            const errorText = getBranchDeletionError(errorMessage, branchName);

            if (errorText !== '刪除分支失敗') {
                return err(errorText);
            }

            logger.error('Git', 'Error', `[Git] Failed to delete branch`, error);
            return err(errorText);
        }
    }

    async hasUncommittedChanges(workspacePath: string): Promise<Result<boolean>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const status = await git.status();
            return !status.isClean();
        }, '檢查未 commit 修改失敗');
    }

    async checkoutBranch(workspacePath: string, branchName: string, force?: boolean): Promise<Result<void>> {
        if (!isValidBranchName(branchName)) {
            return err('無效的分支名稱格式');
        }

        try {
            const git = simpleGit(workspacePath);
            if (force) {
                await git.checkout([branchName, '--force']);
            } else {
                await git.checkout(branchName);
            }
            return ok(undefined);
        } catch (error) {
            const errorMessage = parseGitErrorMessage(error);
            const errorText = getCheckoutError(errorMessage, branchName);

            if (errorText !== '切換分支失敗') {
                return err(errorText);
            }

            logger.error('Git', 'Error', `[Git] Failed to checkout branch`, error);
            return err(errorText);
        }
    }

    async getWorktreeBranches(workspacePath: string): Promise<Result<string[]>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const worktreeList = await git.raw(['worktree', 'list']);

            const worktreeBranches: string[] = [];
            const lines = worktreeList.trim().split('\n');
            const normalizedWorkspacePath = path.normalize(workspacePath);

            for (const line of lines) {
                const pathMatch = line.match(/^(.+?)\s+/);
                if (!pathMatch) continue;

                const worktreePath = path.normalize(pathMatch[1]);
                if (worktreePath === normalizedWorkspacePath) continue;

                const branchMatch = line.match(/\[(.+?)]/);
                if (branchMatch && branchMatch[1]) {
                    worktreeBranches.push(branchMatch[1]);
                }
            }

            return worktreeBranches;
        }, '取得 Worktree 分支列表失敗');
    }

    async getLocalBranches(workspacePath: string): Promise<Result<{
        branches: string[],
        current: string,
        worktreeBranches: string[]
    }>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const branchSummary = await git.branch();

            const localBranches = branchSummary.all.filter(branch => !branch.startsWith('remotes/'));

            const worktreeBranchesResult = await this.getWorktreeBranches(workspacePath);
            const worktreeBranches: string[] = worktreeBranchesResult.success ? worktreeBranchesResult.data! : [];

            return {
                branches: localBranches,
                current: branchSummary.current,
                worktreeBranches
            };
        }, '取得本地分支列表失敗');
    }

    async checkRemoteBranchExists(workspacePath: string, branchName: string): Promise<Result<boolean>> {
        const result = await gitOperation(async () => {
            const git = simpleGit(workspacePath);
            const remotes = await git.getRemotes();

            if (remotes.length === 0 || !remotes.some(r => r.name === 'origin')) {
                return false;
            }

            const lsRemoteResult = await git.raw(['ls-remote', '--heads', 'origin', branchName]);
            return lsRemoteResult.trim().length > 0;
        }, '檢查遠端分支失敗');

        if (!result.success || result.data === undefined) {
            return ok(false);
        }
        return ok(result.data);
    }

    async fetchRemoteBranch(workspacePath: string, branchName: string): Promise<Result<void>> {
        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            await git.raw(['fetch', 'origin', `${branchName}:${branchName}`]);
        }, '從遠端 fetch 分支失敗');
    }

    async createAndCheckoutBranch(workspacePath: string, branchName: string): Promise<Result<void>> {
        if (!isValidBranchName(branchName)) {
            return err('無效的分支名稱格式');
        }

        return gitOperation(async () => {
            const git = simpleGit(workspacePath);
            await git.checkout(['-b', branchName]);
        }, '建立並切換分支失敗');
    }

    async smartCheckoutBranch(
        workspacePath: string,
        branchName: string,
        force?: boolean
    ): Promise<Result<'switched' | 'fetched' | 'created'>> {
        if (!isValidBranchName(branchName)) {
            return err('無效的分支名稱格式');
        }

        const localBranchExists = await this.branchExists(workspacePath, branchName);
        if (!localBranchExists.success) {
            return err(localBranchExists.error!);
        }

        if (localBranchExists.data) {
            const checkoutResult = await this.checkoutBranch(workspacePath, branchName, force);
            if (!checkoutResult.success) {
                return err(checkoutResult.error!);
            }
            return ok('switched');
        }

        const remoteBranchExists = await this.checkRemoteBranchExists(workspacePath, branchName);
        if (!remoteBranchExists.success) {
            return err(remoteBranchExists.error!);
        }

        if (remoteBranchExists.data) {
            const fetchResult = await this.fetchRemoteBranch(workspacePath, branchName);
            if (!fetchResult.success) {
                return err(fetchResult.error!);
            }

            const checkoutResult = await this.checkoutBranch(workspacePath, branchName, force);
            if (!checkoutResult.success) {
                return err(checkoutResult.error!);
            }
            return ok('fetched');
        }

        const createResult = await this.createAndCheckoutBranch(workspacePath, branchName);
        if (!createResult.success) {
            return err(createResult.error!);
        }
        return ok('created');
    }
}

export const gitService = new GitService();
