import os from 'os';
import path from 'path';

/**
 * 驗證 GitLab URL 格式
 * @param url GitLab URL
 * @throws Error 如果 URL 格式不正確
 */
function validateGitLabUrl(url: string | undefined): void {
  if (!url) {
    return;
  }

  // 必須是 HTTPS URL
  if (!url.startsWith('https://')) {
    throw new Error('GITLAB_URL 必須使用 HTTPS 協議');
  }

  // 驗證 URL 格式
  try {
    const urlObj = new URL(url);

    // 驗證 hostname 格式合法（不包含非法字元）
    if (!urlObj.hostname || urlObj.hostname.includes(' ')) {
      throw new Error('GITLAB_URL 包含無效的主機名稱');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('GITLAB_URL 格式不正確');
    }
    throw error;
  }
}

interface Config {
  port: number;
  nodeEnv: string;
  appDataRoot: string;
  canvasRoot: string;
  repositoriesRoot: string;
  corsOrigin: (origin: string | undefined) => boolean;
  githubToken?: string;
  gitlabToken?: string;
  gitlabUrl?: string;
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
  const githubToken = process.env.GITHUB_TOKEN;
  const gitlabToken = process.env.GITLAB_TOKEN;
  const gitlabUrl = process.env.GITLAB_URL?.replace(/\/$/, '');

  // 驗證 GitLab URL
  validateGitLabUrl(gitlabUrl);

  const corsOrigin = (origin: string | undefined): boolean => {
    if (!origin) {
      return true;
    }

    const allowedOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

    return allowedOriginPattern.test(origin);
  };

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
    gitlabToken,
    gitlabUrl,
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
