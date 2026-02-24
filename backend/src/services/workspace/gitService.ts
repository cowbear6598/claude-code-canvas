import {simpleGit, SimpleGitProgressEvent} from 'simple-git';
import {Result, ok, err} from '../../types';
import {config} from '../../config';
import {logger} from '../../utils/logger.js';
import {fileExists} from '../shared/fileResourceHelpers.js';
import {isPathWithinDirectory} from '../../utils/pathValidator.js';
import {gitOperation} from '../../utils/operationHelpers.js';
import path from 'path';
import fs from 'fs/promises';

interface GitCloneProgress {
    stage: string;
    progress: number;
}

interface GitCloneOptions {
    branch?: string;
    onProgress?: (progress: GitCloneProgress) => void;
}

export type CheckoutProgressCallback = (progress: number, message: string) => void;

export interface SmartCheckoutOptions {
    force?: boolean;
    onProgress?: CheckoutProgressCallback;
}

type GitSource = 'github' | 'gitlab' | 'other';

// 允許英數字、底線、連字號、斜線，但不允許 `..` 路徑穿越
const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9_\-/]+$/;

function isValidBranchName(branchName: string): boolean {
    if (!BRANCH_NAME_PATTERN.test(branchName)) {
        return false;
    }
    if (branchName.includes('//')) {
        return false;
    }
    if (branchName.includes('..')) {
        return false;
    }

    return !(branchName.startsWith('/') || branchName.endsWith('/'));
}

function parseGitErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getFetchStageMessage(stage: string): string {
    const stageMessages: Record<string, string> = {
        counting: '計算物件數量...',
        compressing: '壓縮物件...',
        receiving: '接收物件...',
        resolving: '解析差異...',
        writing: '寫入物件...',
    };
    return stageMessages[stage] ?? '處理中...';
}

function getPullLatestError(errorMessage: string): string {
    if (errorMessage.includes('Could not resolve host') || errorMessage.includes('Network') || errorMessage.includes('network')) {
        return '無法連線至遠端伺服器';
    }
    if (errorMessage.includes("couldn't find remote ref")) {
        return '遠端分支不存在';
    }
    return 'Pull 至最新版本失敗';
}

function getBranchDeletionError(errorMessage: string, branchName: string): string {
    if (errorMessage.includes('not fully merged')) {
        return `分支「${branchName}」尚未合併，是否要強制刪除？`;
    }
    return '刪除分支失敗';
}

function getCheckoutError(errorMessage: string, branchName: string): string {
    if (errorMessage.includes('is already checked out at') || errorMessage.includes('is already used by worktree at')) {
        return `無法切換到分支「${branchName}」，該分支已被 Worktree 使用`;
    }
    return '切換分支失敗';
}

function extractDomainFromUrl(url: string): string {
    if (url.startsWith('git@')) {
        const match = url.match(/^git@([^:]+):/);
        return match ? match[1] : '';
    }

    if (url.startsWith('https://') || url.startsWith('http://')) {
        const match = url.match(/^https?:\/\/([^/]+)/);
        return match ? match[1] : '';
    }

    return '';
}

function detectGitSource(repoUrl: string): GitSource {
    const domain = extractDomainFromUrl(repoUrl);

    if (repoUrl.includes('github.com') || domain === 'github.com') {
        return 'github';
    }

    if (repoUrl.includes('gitlab.com') || domain === 'gitlab.com') {
        return 'gitlab';
    }

    if (config.gitlabUrl) {
        const gitlabDomain = extractDomainFromUrl(config.gitlabUrl);
        if (domain === gitlabDomain) {
            return 'gitlab';
        }
    }

    return 'other';
}

function buildAuthenticatedUrl(repoUrl: string): string {
    const source = detectGitSource(repoUrl);

    if (source === 'github' && config.githubToken) {
        if (repoUrl.startsWith('https://github.com/')) {
            return repoUrl.replace(
                'https://github.com/',
                `https://${config.githubToken}@github.com/`
            );
        }
        return repoUrl;
    }

    if (source === 'gitlab' && config.gitlabToken) {
        if (repoUrl.startsWith('https://gitlab.com/')) {
            return repoUrl.replace(
                'https://gitlab.com/',
                `https://oauth2:${config.gitlabToken}@gitlab.com/`
            );
        }

        if (config.gitlabUrl && repoUrl.startsWith(config.gitlabUrl)) {
            const urlWithoutProtocol = config.gitlabUrl.replace(/^https?:\/\//, '');
            return repoUrl.replace(
                `https://${urlWithoutProtocol}/`,
                `https://oauth2:${config.gitlabToken}@${urlWithoutProtocol}/`
            );
        }
        return repoUrl;
    }

    return repoUrl;
}

function parseCloneErrorMessage(error: unknown, source: GitSource): string {
    const errorMessage = parseGitErrorMessage(error);

    if (errorMessage.includes('Authentication failed')) {
        return '認證失敗，請檢查 Token 是否正確';
    }

    if (errorMessage.includes('Repository not found') || errorMessage.includes('not found')) {
        return '找不到指定的倉庫';
    }

    if (errorMessage.includes('could not read Username')) {
        if (source === 'github') {
            return '無法存取私有倉庫，請設定 GITHUB_TOKEN';
        }
        if (source === 'gitlab') {
            return '無法存取私有倉庫，請設定 GITLAB_TOKEN';
        }
        return '無法存取私有倉庫，請設定對應的 Token';
    }

    return '複製儲存庫失敗';
}

class GitService {
    async clone(
        repoUrl: string,
        targetPath: string,
        options?: GitCloneOptions
    ): Promise<Result<void>> {
        const source = detectGitSource(repoUrl);

        try {
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

            const authenticatedUrl = buildAuthenticatedUrl(repoUrl);
            const cloneOptions = options?.branch ? ['--branch', options.branch] : [];
            await git.clone(authenticatedUrl, targetPath, cloneOptions);
            return ok(undefined);
        } catch (error) {
            const errorMessage = parseCloneErrorMessage(error, source);
            // logger.error 已經內建清理機制，直接傳入錯誤即可
            logger.error('Git', 'Error', `[Git] Failed to clone repository`, error);
            return err(errorMessage);
        }
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

            // macOS 上 /tmp 是 /private/tmp 的 symlink，需要解析真實路徑才能正確比較
            const realWorkspacePath = await fs.realpath(workspacePath);

            for (const line of lines) {
                const pathMatch = line.match(/^(.+?)\s+/);
                if (!pathMatch) continue;

                const worktreePath = path.normalize(pathMatch[1]);
                if (worktreePath === realWorkspacePath) continue;

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

    async fetchRemoteBranch(
        workspacePath: string,
        branchName: string,
        onProgress?: (progress: GitCloneProgress) => void
    ): Promise<Result<void>> {
        return gitOperation(async () => {
            const git = simpleGit({
                baseDir: workspacePath,
                progress: onProgress
                    ? (event: SimpleGitProgressEvent): void => {
                        onProgress({ stage: event.stage, progress: event.progress });
                    }
                    : undefined,
            });
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

    async pullLatest(
        workspacePath: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<Result<void>> {
        const currentBranchResult = await this.getCurrentBranch(workspacePath);
        if (!currentBranchResult.success) {
            return err('取得目前分支失敗');
        }

        const currentBranch = currentBranchResult.data!;

        if (!currentBranch || !isValidBranchName(currentBranch)) {
            return err('無效的分支名稱格式');
        }

        onProgress?.(5, '取得分支資訊...');

        try {
            const git = simpleGit({
                baseDir: workspacePath,
                progress: onProgress
                    ? (event: SimpleGitProgressEvent): void => {
                        const mappedProgress = Math.floor(10 + event.progress * 0.7);
                        const stageMessage = getFetchStageMessage(event.stage);
                        onProgress(mappedProgress, stageMessage);
                    }
                    : undefined,
            });
            await git.fetch(['origin', currentBranch]);
            onProgress?.(85, '重設至最新版本...');
            await git.reset(['--hard', `origin/${currentBranch}`]);
            return ok(undefined);
        } catch (error) {
            const errorMessage = parseGitErrorMessage(error);
            const errorText = getPullLatestError(errorMessage);
            logger.error('Git', 'Error', `[Git] Failed to pull latest`, error);
            return err(errorText);
        }
    }

    async smartCheckoutBranch(
        workspacePath: string,
        branchName: string,
        options?: SmartCheckoutOptions
    ): Promise<Result<'switched' | 'fetched' | 'created'>> {
        const { force, onProgress } = options ?? {};

        if (!isValidBranchName(branchName)) {
            return err('無效的分支名稱格式');
        }

        const localBranchExists = await this.branchExists(workspacePath, branchName);
        if (!localBranchExists.success) {
            return err(localBranchExists.error!);
        }

        onProgress?.(10, '檢查本地分支...');

        if (localBranchExists.data) {
            onProgress?.(80, '切換分支...');
            const checkoutResult = await this.checkoutBranch(workspacePath, branchName, force);
            if (!checkoutResult.success) {
                return err(checkoutResult.error!);
            }
            return ok('switched');
        }

        onProgress?.(20, '檢查遠端分支...');
        const remoteBranchExists = await this.checkRemoteBranchExists(workspacePath, branchName);
        if (!remoteBranchExists.success) {
            return err(remoteBranchExists.error!);
        }

        if (remoteBranchExists.data) {
            const fetchResult = await this.fetchRemoteBranch(workspacePath, branchName, (progressData) => {
                const mappedProgress = Math.floor(20 + progressData.progress * 0.6);
                const stageMessage = getFetchStageMessage(progressData.stage);
                onProgress?.(mappedProgress, stageMessage);
            });
            if (!fetchResult.success) {
                return err(fetchResult.error!);
            }

            onProgress?.(80, '切換分支...');
            const checkoutResult = await this.checkoutBranch(workspacePath, branchName, force);
            if (!checkoutResult.success) {
                return err(checkoutResult.error!);
            }
            return ok('fetched');
        }

        onProgress?.(80, '建立並切換分支...');
        const createResult = await this.createAndCheckoutBranch(workspacePath, branchName);
        if (!createResult.success) {
            return err(createResult.error!);
        }
        return ok('created');
    }
}

export const gitService = new GitService();

export {
    detectGitSource,
    buildAuthenticatedUrl,
    parseCloneErrorMessage,
    extractDomainFromUrl,
    getPullLatestError,
    type GitSource
};
