import {simpleGit, StatusResult, SimpleGitProgressEvent} from 'simple-git';
import { Result, ok, err } from '../../types/index.js';
import {config} from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { fileExists } from '../shared/fileResourceHelpers.js';
import { isPathWithinDirectory } from '../../utils/pathValidator.js';
import path from 'path';

interface GitCloneProgress {
    stage: string;
    progress: number;
}

interface GitCloneOptions {
    branch?: string;
    onProgress?: (progress: GitCloneProgress) => void;
}

class GitService {
    async clone(
        repoUrl: string,
        targetPath: string,
        options?: GitCloneOptions
    ): Promise<Result<void>> {
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
            return ok(undefined);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Clone failed`, error);
            return err('複製儲存庫失敗');
        }
    }

    async getStatus(workspacePath: string): Promise<Result<StatusResult>> {
        try {
            const git = simpleGit(workspacePath);
            const status = await git.status();
            return ok(status);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to get status`, error);
            return err('取得 Git 狀態失敗');
        }
    }

    async getCurrentBranch(workspacePath: string): Promise<Result<string>> {
        try {
            const git = simpleGit(workspacePath);
            const status = await git.status();
            return ok(status.current || 'unknown');
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to get current branch`, error);
            return err('取得目前分支失敗');
        }
    }

    async listBranches(workspacePath: string): Promise<Result<string[]>> {
        try {
            const git = simpleGit(workspacePath);
            const branches = await git.branch();
            return ok(branches.all);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to list branches`, error);
            return err('取得分支列表失敗');
        }
    }

    async isGitRepository(workspacePath: string): Promise<Result<boolean>> {
        const gitPath = path.join(workspacePath, '.git');
        const exists = await fileExists(gitPath);
        return ok(exists);
    }

    async hasCommits(workspacePath: string): Promise<Result<boolean>> {
        try {
            const git = simpleGit(workspacePath);
            await git.revparse(['HEAD']);
            return ok(true);
        } catch {
            return ok(false);
        }
    }

    async branchExists(workspacePath: string, branchName: string): Promise<Result<boolean>> {
        try {
            const git = simpleGit(workspacePath);
            const branches = await git.branch();
            return ok(branches.all.includes(branchName));
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to check branch existence`, error);
            return err('檢查分支失敗');
        }
    }

    async createWorktree(workspacePath: string, worktreePath: string, branchName: string): Promise<Result<void>> {
        try {
            if (!isPathWithinDirectory(worktreePath, config.repositoriesRoot)) {
                return err('無效的 worktree 路徑');
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(branchName)) {
                return err('無效的分支名稱');
            }

            const git = simpleGit(workspacePath);
            await git.raw(['worktree', 'add', '-b', branchName, worktreePath]);
            return ok(undefined);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to create worktree`, error);
            return err('建立 Worktree 失敗');
        }
    }

    async removeWorktree(parentRepoPath: string, worktreePath: string): Promise<Result<void>> {
        try {
            if (!isPathWithinDirectory(worktreePath, config.repositoriesRoot)) {
                return err('無效的 worktree 路徑');
            }

            const git = simpleGit(parentRepoPath);
            await git.raw(['worktree', 'remove', worktreePath]);
            return ok(undefined);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to remove worktree`, error);
            return err('移除 Worktree 失敗');
        }
    }

    async deleteBranch(workspacePath: string, branchName: string): Promise<Result<void>> {
        try {
            const git = simpleGit(workspacePath);
            await git.raw(['branch', '-D', branchName]);
            return ok(undefined);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Failed to delete branch`, error);
            return err('刪除分支失敗');
        }
    }
}

export const gitService = new GitService();
