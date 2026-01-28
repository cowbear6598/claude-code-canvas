// Git Service Mock
// Mock simple-git 模組
// 支援成功/失敗場景

import { vi } from 'vitest';

export interface MockCloneResult {
  success: boolean;
  error?: string;
}

// Mock 設定
let mockCloneResult: MockCloneResult = { success: true };

/**
 * 設定 Clone 結果
 */
export function setMockCloneResult(result: MockCloneResult): void {
  mockCloneResult = result;
}

/**
 * 重置 Mock 狀態
 */
export function resetGitMock(): void {
  mockCloneResult = { success: true };
}

/**
 * Mock 的 clone 函數
 */
async function mockClone(): Promise<void> {
  // 模擬一些延遲
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!mockCloneResult.success) {
    throw new Error(mockCloneResult.error || 'Clone failed');
  }
}

/**
 * Mock 的 simpleGit 實例
 */
const mockGitInstance = {
  clone: vi.fn(mockClone),
};

// Mock simple-git 模組
vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
  simpleGit: vi.fn(() => mockGitInstance),
}));

export { mockGitInstance };
