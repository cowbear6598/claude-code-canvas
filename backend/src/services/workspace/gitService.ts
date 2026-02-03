import {simpleGit, StatusResult, SimpleGitProgressEvent} from 'simple-git';
import { Result, ok, err } from '../../types/index.js';
import {config} from '../../config/index.js';
import { logger } from '../../utils/logger.js';

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
}

export const gitService = new GitService();
