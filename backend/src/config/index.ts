// Configuration Module
// Loads and validates environment variables

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  workspaceRoot: string;
  corsOrigin: string;
  githubToken?: string;
  outputStylesPath: string;
}

function loadConfig(): Config {
  // Load environment variables with defaults
  const port = parseInt(process.env.PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const workspaceRoot = process.env.WORKSPACE_ROOT || './workspaces';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const githubToken = process.env.GITHUB_TOKEN;
  const outputStylesPath = process.env.OUTPUT_STYLES_PATH || './output-styles';

  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  // Always use Claude Code CLI authentication
  console.log('✓ Using Claude Code CLI authentication');

  return {
    port,
    nodeEnv,
    workspaceRoot,
    corsOrigin,
    githubToken,
    outputStylesPath,
  };
}

// Export singleton configuration object
export const config = loadConfig();
