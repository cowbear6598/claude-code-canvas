// Git Service Mock
// Mock simple-git 模組
// 支援成功/失敗場景
//
// 注意：由於 Vitest 的 vi.mock() 必須在測試檔案的頂層執行，
// 這個檔案目前僅作為參考。實際 mock 實作請參考 git.test.ts。
//
// 在測試檔案中使用 vi.mock() 的範例：
//
// let mockCloneResult = { success: true };
// const mockCloneFn = vi.fn(async () => {
//   await new Promise(resolve => setTimeout(resolve, 100));
//   if (!mockCloneResult.success) throw new Error(mockCloneResult.error || 'Clone failed');
// });
// vi.mock('simple-git', () => ({
//   simpleGit: vi.fn(() => ({ clone: mockCloneFn })),
//   default: vi.fn(() => ({ clone: mockCloneFn })),
// }));

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
// 注意：這個 mock 可能無法正常工作，因為 vi.mock() 需要在測試檔案頂層執行
// 請參考 git.test.ts 中的實際實作
vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
  simpleGit: vi.fn(() => mockGitInstance),
}));

export { mockGitInstance };
