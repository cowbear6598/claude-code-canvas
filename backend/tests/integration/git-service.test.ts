import { describe, it, expect, beforeEach, vi } from 'vitest';
import { config } from '../../src/config/index.js';

vi.mock('simple-git', () => {
  let mockCloneArgs: { url: string; path: string; options: string[] } | null = null;
  let mockProgressCallback: ((event: { stage: string; progress: number }) => void) | null = null;
  let mockShouldFail = false;
  let mockProgressStages: Array<{ stage: string; progress: number }> = [];

  return {
    simpleGit: vi.fn((options?: { progress?: (event: { stage: string; progress: number }) => void }) => {
      if (options?.progress) {
        mockProgressCallback = options.progress;
      }

      return {
        clone: vi.fn(async (url: string, path: string, options: string[] = []) => {
          mockCloneArgs = { url, path, options };

          if (mockProgressStages.length > 0 && mockProgressCallback) {
            for (const stage of mockProgressStages) {
              mockProgressCallback(stage);
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          }

          if (mockShouldFail) {
            throw new Error('Git clone failed');
          }
        }),
      };
    }),
    __setMockCloneArgs: (args: { url: string; path: string; options: string[] } | null) => {
      mockCloneArgs = args;
    },
    __getMockCloneArgs: () => mockCloneArgs,
    __setMockShouldFail: (shouldFail: boolean) => {
      mockShouldFail = shouldFail;
    },
    __setMockProgressStages: (stages: Array<{ stage: string; progress: number }>) => {
      mockProgressStages = stages;
    },
    __resetMocks: () => {
      mockCloneArgs = null;
      mockProgressCallback = null;
      mockShouldFail = false;
      mockProgressStages = [];
    },
  };
});

describe('gitService', () => {
  beforeEach(async () => {
    const simpleGit = await import('simple-git');
    (simpleGit as any).__resetMocks();
  });

  describe('clone', () => {
    it('success_when_github_token_adds_authentication', async () => {
      const originalToken = config.githubToken;
      (config as any).githubToken = 'test-token-12345';

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      await gitService.clone(repoUrl, targetPath);

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.url).toContain('test-token-12345');
      expect(mockArgs.url).toContain('github.com');

      (config as any).githubToken = originalToken;
    });

    it('success_when_no_github_token_uses_original_url', async () => {
      const originalToken = config.githubToken;
      (config as any).githubToken = undefined;

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      await gitService.clone(repoUrl, targetPath);

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.url).toBe(repoUrl);

      (config as any).githubToken = originalToken;
    });

    it('success_when_non_github_url_uses_original', async () => {
      const originalToken = config.githubToken;
      (config as any).githubToken = 'test-token-12345';

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://gitlab.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      await gitService.clone(repoUrl, targetPath);

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.url).toBe(repoUrl);
      expect(mockArgs.url).not.toContain('test-token-12345');

      (config as any).githubToken = originalToken;
    });

    it('success_when_https_url_replaces_correctly', async () => {
      const originalToken = config.githubToken;
      (config as any).githubToken = 'test-token-12345';

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      await gitService.clone(repoUrl, targetPath);

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.url).toBe('https://test-token-12345@github.com/user/repo.git');

      (config as any).githubToken = originalToken;
    });

    it('success_when_branch_specified_adds_option', async () => {
      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';
      const branch = 'develop';

      await gitService.clone(repoUrl, targetPath, { branch });

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.options).toContain('--branch');
      expect(mockArgs.options).toContain(branch);
    });

    it('success_when_no_branch_skips_option', async () => {
      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      await gitService.clone(repoUrl, targetPath);

      const simpleGit = await import('simple-git');
      const mockArgs = (simpleGit as any).__getMockCloneArgs();

      expect(mockArgs).toBeDefined();
      expect(mockArgs.options).toHaveLength(0);
    });

    it('success_when_progress_callback_provided_calls', async () => {
      const simpleGit = await import('simple-git');
      (simpleGit as any).__setMockProgressStages([
        { stage: 'receiving', progress: 50 },
        { stage: 'resolving', progress: 100 },
      ]);

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      const progressUpdates: Array<{ stage: string; progress: number }> = [];
      const onProgress = (progress: { stage: string; progress: number }): void => {
        progressUpdates.push(progress);
      };

      await gitService.clone(repoUrl, targetPath, { onProgress });

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0].stage).toBe('receiving');
      expect(progressUpdates[0].progress).toBe(50);
      expect(progressUpdates[1].stage).toBe('resolving');
      expect(progressUpdates[1].progress).toBe(100);
    });

    it('failed_when_clone_fails_returns_error', async () => {
      const simpleGit = await import('simple-git');
      (simpleGit as any).__setMockShouldFail(true);

      const { gitService } = await import('../../src/services/workspace/gitService.js');
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/test-repo';

      const result = await gitService.clone(repoUrl, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('複製儲存庫失敗');
    });
  });
});
