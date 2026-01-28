// Configuration Module
// Loads and validates environment variables

import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

// Load environment variables
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
}

function loadConfig(): Config {
  // Load environment variables with defaults
  const port = parseInt(process.env.PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const githubToken = process.env.GITHUB_TOKEN;

  // 根目錄：~/Documents/ClaudeCanvas
  const dataRoot = path.join(os.homedir(), 'Documents', 'ClaudeCanvas');

  const appDataRoot = dataRoot;
  const canvasRoot = path.join(dataRoot, 'canvas');
  const repositoriesRoot = path.join(dataRoot, 'repositories');
  const outputStylesPath = path.join(dataRoot, 'output-styles');
  const skillsPath = path.join(dataRoot, 'skills');
  const agentsPath = path.join(dataRoot, 'agents');

  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  // Always use Claude Code CLI authentication
  console.log('✓ Using Claude Code CLI authentication');

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
  };
}

// Export singleton configuration object
export const config = loadConfig();
