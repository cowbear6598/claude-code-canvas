// Vitest 全域 Setup
// 在測試開始前執行的設定，並提供 teardown 函數

import { mkdir, rm } from 'fs/promises';
import { testConfig } from './testConfig.js';

/**
 * 全域 Setup 函數
 * 在所有測試開始前執行
 */
export async function setup(): Promise<void> {
  // 建立測試用暫存目錄
  try {
    await mkdir(testConfig.appDataRoot, { recursive: true });
    await mkdir(testConfig.canvasRoot, { recursive: true });
    await mkdir(testConfig.repositoriesRoot, { recursive: true });
    await mkdir(testConfig.outputStylesPath, { recursive: true });
    await mkdir(testConfig.skillsPath, { recursive: true });
    await mkdir(testConfig.agentsPath, { recursive: true });
    await mkdir(testConfig.commandsPath, { recursive: true });

    console.log('[Test Setup] Created test directories at:', testConfig.appDataRoot);
  } catch (error) {
    console.error('[Test Setup] Failed to create test directories:', error);
    throw error;
  }
}

/**
 * 全域 Teardown 函數
 * 在所有測試結束後執行
 */
export async function teardown(): Promise<void> {
  // 清理測試用暫存目錄
  try {
    await rm(testConfig.appDataRoot, { recursive: true, force: true });
    console.log('[Test Teardown] Cleaned up test directories at:', testConfig.appDataRoot);
  } catch (error) {
    console.error('[Test Teardown] Failed to clean up test directories:', error);
    // 不拋出錯誤，避免影響測試結果
  }
}

// 預設導出 setup 函數（Vitest globalSetup 需要）
export default setup;
