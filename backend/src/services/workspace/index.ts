import { promises as fs } from 'fs';
import path from 'path';
import { Result, ok } from '../../types/index.js';
import { config } from '../../config/index.js';

class WorkspaceService {
  async createWorkspace(podId: string): Promise<Result<string>> {
    const workspacePath = this.getWorkspacePath(podId);

    await fs.mkdir(workspacePath, { recursive: true });
    return ok(workspacePath);
  }

  async deleteWorkspace(podId: string): Promise<Result<void>> {
    const workspacePath = this.getWorkspacePath(podId);

    await fs.rm(workspacePath, { recursive: true, force: true });
    return ok(undefined);
  }

  getWorkspacePath(podId: string): string {
    return path.join(config.canvasRoot, `pod-${podId}`);
  }

  async workspaceExists(podId: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(podId);

    try {
      await fs.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }

  async listWorkspaceFiles(podId: string): Promise<Result<string[]>> {
    const workspacePath = this.getWorkspacePath(podId);

    const files = await this.readDirRecursive(workspacePath, workspacePath);
    return ok(files);
  }

  private async readDirRecursive(
    dirPath: string,
    basePath: string
  ): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist'
        ) {
          continue;
        }

        const subFiles = await this.readDirRecursive(fullPath, basePath);
        files.push(...subFiles);
      } else {
        const relativePath = path.relative(basePath, fullPath);
        files.push(relativePath);
      }
    }

    return files;
  }
}

export const workspaceService = new WorkspaceService();
