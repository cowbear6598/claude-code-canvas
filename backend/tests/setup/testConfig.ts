// 測試環境設定
// 覆寫 config 物件，使用暫存目錄路徑

import { mock } from 'bun:test';
import path from 'path';
import os from 'os';

// 增加 EventEmitter 的 max listeners 限制，避免測試中的警告
// 每個測試都會建立 socket 連線，導致 listeners 累積
process.setMaxListeners(50);

// =============================================================================
// Console Mock - 隱藏所有測試期間的 console 輸出
// =============================================================================

// 保存原始的 console 方法（如果需要在特定測試中恢復）
export const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Mock 所有 console 方法 - 必須在最早期就執行
console.log = () => {};
console.error = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

// Mock logger 模組 - 必須在任何可能使用 logger 的模組載入之前執行
// 注意：這個 mock 必須完全覆蓋 Logger 類別的所有方法
mock.module('../../src/utils/logger.js', () => {
  // 建立一個完全靜默的 Logger 類別
  class MockLogger {
    log(): void {
      // 不執行任何操作
    }
    error(): void {
      // 不執行任何操作
    }
  }

  return {
    Logger: MockLogger,
    logger: new MockLogger(),
  };
});

const timestamp = Date.now();

export interface TestConfig {
  port: number;
  nodeEnv: string;
  appDataRoot: string;
  canvasRoot: string;
  repositoriesRoot: string;
  corsOrigin: string;
  githubToken?: string;
  outputStylesPath: string;
  skillsPath: string;
  agentsPath: string;
  commandsPath: string;
}

// 使用暫存目錄避免影響實際資料
const testRoot = path.join(os.tmpdir(), `test-canvas-${timestamp}`);

export const testConfig: TestConfig = {
  port: 0, // 動態分配 port
  nodeEnv: 'test',
  appDataRoot: testRoot,
  canvasRoot: path.join(testRoot, 'canvas'),
  repositoriesRoot: path.join(testRoot, 'repositories'),
  corsOrigin: 'http://localhost:5173',
  githubToken: undefined,
  outputStylesPath: path.join(testRoot, 'output-styles'),
  skillsPath: path.join(testRoot, 'skills'),
  agentsPath: path.join(testRoot, 'agents'),
  commandsPath: path.join(testRoot, 'commands'),
};

// 覆寫 config 模組的設定
export async function overrideConfig(): Promise<void> {
  const configModule = await import('../../src/config/index.js');
  Object.assign(configModule.config, testConfig);

  // 重新綁定方法使其使用新的 canvasRoot
  configModule.config.getCanvasPath = function (canvasName: string): string {
    const canvasPath = path.join(testConfig.canvasRoot, canvasName);
    const resolvedPath = path.resolve(canvasPath);
    const resolvedRoot = path.resolve(testConfig.canvasRoot);

    if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
      throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
    }

    return canvasPath;
  };

  configModule.config.getCanvasDataPath = function (canvasName: string): string {
    const canvasPath = path.join(testConfig.canvasRoot, canvasName, 'data');
    const resolvedPath = path.resolve(canvasPath);
    const resolvedRoot = path.resolve(testConfig.canvasRoot);

    if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
      throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
    }

    return canvasPath;
  };
}

// 立即執行覆寫（在 setupFiles 階段）
// 這確保在任何測試模組載入之前就覆寫 config
const configModule = await import('../../src/config/index.js');
Object.assign(configModule.config, testConfig);

// 重新綁定方法
configModule.config.getCanvasPath = function (canvasName: string): string {
  const canvasPath = path.join(testConfig.canvasRoot, canvasName);
  const resolvedPath = path.resolve(canvasPath);
  const resolvedRoot = path.resolve(testConfig.canvasRoot);

  if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
  }

  return canvasPath;
};

configModule.config.getCanvasDataPath = function (canvasName: string): string {
  const canvasPath = path.join(testConfig.canvasRoot, canvasName, 'data');
  const resolvedPath = path.resolve(canvasPath);
  const resolvedRoot = path.resolve(testConfig.canvasRoot);

  if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
  }

  return canvasPath;
};
