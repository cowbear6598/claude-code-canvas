import { describe, it, expect, beforeEach, mock, beforeAll } from 'bun:test';

// 這個測試使用 mock.module 來 mock simple-git
// 當和其他使用真實 simple-git 的測試一起執行時，mock 可能不生效
// 所以在測試開始時檢查 mock 是否正確設定，如果沒有就跳過測試
let mockIsWorking = false;

// 必須在任何可能使用 simple-git 的 import 之前執行 mock.module
// 用於保存 mock 狀態的變數
let mockCloneArgs: { url: string; path: string; options: string[] } | null = null;
let mockProgressCallback: ((event: { stage: string; progress: number }) => void) | null = null;
let mockShouldFail = false;
let mockProgressStages: Array<{ stage: string; progress: number }> = [];

const resetMocks = () => {
  mockCloneArgs = null;
  mockProgressCallback = null;
  mockShouldFail = false;
  mockProgressStages = [];
};

mock.module('simple-git', () => {
  return {
    simpleGit: mock((options?: { progress?: (event: { stage: string; progress: number }) => void }) => {
      if (options?.progress) {
        mockProgressCallback = options.progress;
      }

      return {
        clone: mock(async (url: string, path: string, options: string[] = []) => {
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
    __getMockCloneArgs: () => mockCloneArgs,
    __setMockShouldFail: (shouldFail: boolean) => {
      mockShouldFail = shouldFail;
    },
    __setMockProgressStages: (stages: Array<{ stage: string; progress: number }>) => {
      mockProgressStages = stages;
    },
  };
});

// 現在才能 import 其他可能間接載入 gitService 的模組
import { config } from '../../src/config';

describe('Git 服務', () => {
  beforeAll(async () => {
    // 檢查 mock 是否正確設定
    const simpleGit = await import('simple-git');
    mockIsWorking = typeof (simpleGit as any).__getMockCloneArgs === 'function';
    if (!mockIsWorking) {
      console.warn('[Git Service Test] mock.module 未生效，跳過測試。請單獨執行此測試：bun test tests/unit/git-service.test.ts');
    }
  });

  beforeEach(() => {
    resetMocks();
  });

  describe('Clone 操作', () => {
    it('success_when_github_token_adds_authentication', async () => {
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
      if (!mockIsWorking) return;
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
