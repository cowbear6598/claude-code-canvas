import { promises as fs } from 'fs';
import path from 'path';
import { Result, ok, err } from '../../types/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class WorkspaceService {
  private validatePath(workspacePath: string): boolean {
    const resolvedPath = path.resolve(workspacePath);
    const resolvedRoot = path.resolve(config.canvasRoot);
    return resolvedPath.startsWith(resolvedRoot + path.sep);
  }

  async createWorkspace(workspacePath: string): Promise<Result<string>> {
    if (!this.validatePath(workspacePath)) {
      logger.error('Workspace', 'Error', `Path validation failed: ${workspacePath}`);
      return err('Invalid workspace path');
    }
    await fs.mkdir(workspacePath, { recursive: true });
    return ok(workspacePath);
  }

  async deleteWorkspace(workspacePath: string): Promise<Result<void>> {
    if (!this.validatePath(workspacePath)) {
      logger.error('Workspace', 'Error', `Path validation failed: ${workspacePath}`);
      return err('Invalid workspace path');
    }
    await fs.rm(workspacePath, { recursive: true, force: true });
    return ok(undefined);
  }
}

export const workspaceService = new WorkspaceService();
