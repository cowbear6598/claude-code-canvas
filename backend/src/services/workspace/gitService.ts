// Git Service
// Manages Git operations using simple-git

import {simpleGit, StatusResult} from 'simple-git';
import {config} from '../../config/index.js';

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
    ): Promise<void> {
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
            console.log(
                `[Git] Cloned repository: ${repoUrl} to ${targetPath}${
                    branch ? ` (branch: ${branch})` : ''
                }`
            );
        } catch (error) {
            console.error(`[Git] Clone failed: ${error}`);
            throw new Error(
                `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get Git status for a workspace
     */
    async getStatus(workspacePath: string): Promise<StatusResult> {
        try {
            const git = simpleGit(workspacePath);
            return await git.status();
        } catch (error) {
            console.error(`[Git] Failed to get status: ${error}`);
            throw new Error('Failed to get Git status');
        }
    }

    /**
     * Get current branch name
     */
    async getCurrentBranch(workspacePath: string): Promise<string> {
        try {
            const git = simpleGit(workspacePath);
            const status = await git.status();
            return status.current || 'unknown';
        } catch (error) {
            console.error(`[Git] Failed to get current branch: ${error}`);
            throw new Error('Failed to get current branch');
        }
    }

    /**
     * List all branches
     */
    async listBranches(workspacePath: string): Promise<string[]> {
        try {
            const git = simpleGit(workspacePath);
            const branches = await git.branch();
            return branches.all;
        } catch (error) {
            console.error(`[Git] Failed to list branches: ${error}`);
            throw new Error('Failed to list branches');
        }
    }
}

// Export singleton instance
export const gitService = new GitService();
