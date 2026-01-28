import {simpleGit, StatusResult} from 'simple-git';
import { Result, ok, err } from '../../types/index.js';
import {config} from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class GitService {
    /**
     * Clone a Git repository
     * @param repoUrl Repository URL (supports HTTPS and SSH)
     * @param targetPath Absolute path to clone into
     * @param branch Optional branch name (defaults to main)
     */
    async clone(
        repoUrl: string,
        targetPath: string,
        branch?: string
    ): Promise<Result<void>> {
        try {
            const git = simpleGit();

            // Add GitHub token authentication if available
            let authenticatedUrl = repoUrl;
            if (config.githubToken && repoUrl.includes('github.com')) {
                // Convert HTTPS URLs to use token authentication
                if (repoUrl.startsWith('https://github.com/')) {
                    authenticatedUrl = repoUrl.replace(
                        'https://github.com/',
                        `https://${config.githubToken}@github.com/`
                    );
                }
            }

            const cloneOptions = branch ? ['--branch', branch] : [];

            await git.clone(authenticatedUrl, targetPath, cloneOptions);
            return ok(undefined);
        } catch (error) {
            logger.error('Git', 'Error', `[Git] Clone failed`, error);
            return err('複製儲存庫失敗');
        }
    }

    /**
     * Get Git status for a workspace
     */
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

    /**
     * Get current branch name
     */
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

    /**
     * List all branches
     */
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
