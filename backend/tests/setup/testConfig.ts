// 測試環境設定
// 覆寫 config 物件，使用暫存目錄路徑

import path from 'path';
import os from 'os';

// 增加 EventEmitter 的 max listeners 限制，避免測試中的警告
// 每個測試都會建立 socket 連線，導致 listeners 累積
process.setMaxListeners(50);

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
};

// 覆寫 config 模組的設定
export async function overrideConfig(): Promise<void> {
  const configModule = await import('../../src/config/index.js');
  Object.assign(configModule.config, testConfig);
}
