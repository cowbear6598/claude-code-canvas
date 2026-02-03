import { vi } from 'vitest';
import type { Result } from '../../src/types/index.js';
import { ok, err } from '../../src/types/index.js';

interface MockCloneResult {
  success: boolean;
  error?: string;
}

interface MockCloneProgress {
  stage: string;
  progress: number;
}

interface LastCloneCall {
  url: string;
  destPath: string;
  options?: any;
}

let mockResult: MockCloneResult = { success: true };
let mockProgressStages: MockCloneProgress[] = [];
let lastCloneCall: LastCloneCall | null = null;

export function setMockCloneResult(result: MockCloneResult): void {
  mockResult = result;
}

export function setMockCloneProgress(stages: MockCloneProgress[]): void {
  mockProgressStages = stages;
}

export function resetGitMock(): void {
  mockResult = { success: true };
  mockProgressStages = [];
  lastCloneCall = null;
}

export function getLastCloneCall(): LastCloneCall | null {
  return lastCloneCall;
}

const mockClone = vi.fn(
  async (
    repoUrl: string,
    destPath: string,
    options?: { branch?: string; onProgress?: (progress: MockCloneProgress) => void }
  ): Promise<Result<void>> => {
    lastCloneCall = { url: repoUrl, destPath, options };

    if (mockProgressStages.length > 0 && options?.onProgress) {
      for (const stage of mockProgressStages) {
        options.onProgress(stage);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    if (mockResult.success) {
      return ok(undefined);
    }

    return err(mockResult.error || '複製儲存庫失敗');
  }
);

vi.mock('../../src/services/workspace/gitService.js', () => ({
  gitService: {
    clone: mockClone,
  },
}));
