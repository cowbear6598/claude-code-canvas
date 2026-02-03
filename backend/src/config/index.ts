import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

dotenv.config();

interface Config {
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
  getCanvasPath(canvasName: string): string;
  getCanvasDataPath(canvasName: string): string;
}

function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const githubToken = process.env.GITHUB_TOKEN;

  const dataRoot = path.join(os.homedir(), 'Documents', 'ClaudeCanvas');

  const appDataRoot = dataRoot;
  const canvasRoot = path.join(dataRoot, 'canvas');
  const repositoriesRoot = path.join(dataRoot, 'repositories');
  const outputStylesPath = path.join(dataRoot, 'output-styles');
  const skillsPath = path.join(dataRoot, 'skills');
  const agentsPath = path.join(dataRoot, 'agents');
  const commandsPath = path.join(dataRoot, 'commands');

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT 必須是 1 到 65535 之間的有效數字');
  }

  return {
    port,
    nodeEnv,
    appDataRoot,
    canvasRoot,
    repositoriesRoot,
    corsOrigin,
    githubToken,
    outputStylesPath,
    skillsPath,
    agentsPath,
    commandsPath,
    getCanvasPath(canvasName: string): string {
      const canvasPath = path.join(canvasRoot, canvasName);
      const resolvedPath = path.resolve(canvasPath);
      const resolvedRoot = path.resolve(canvasRoot);

      if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
      }

      return canvasPath;
    },
    getCanvasDataPath(canvasName: string): string {
      const canvasPath = path.join(canvasRoot, canvasName, 'data');
      const resolvedPath = path.resolve(canvasPath);
      const resolvedRoot = path.resolve(canvasRoot);

      if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error('無效的 canvas 名稱：偵測到路徑穿越');
      }

      return canvasPath;
    },
  };
}

export const config = loadConfig();
