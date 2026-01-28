import { promises as fs } from 'fs';
import path from 'path';
import { Result, ok } from '../../types/index.js';
import { config } from '../../config/index.js';

class WorkspaceService {
  /**
   * Create a workspace directory for a Pod
   * @returns The absolute path to the created workspace
   */
  async createWorkspace(podId: string): Promise<Result<string>> {
    const workspacePath = this.getWorkspacePath(podId);

    await fs.mkdir(workspacePath, { recursive: true });
    return ok(workspacePath);
  }

  /**
   * Delete a workspace directory
   */
  async deleteWorkspace(podId: string): Promise<Result<void>> {
    const workspacePath = this.getWorkspacePath(podId);

    await fs.rm(workspacePath, { recursive: true, force: true });
    return ok(undefined);
  }

  /**
   * Get workspace path for a Pod
   */
  getWorkspacePath(podId: string): string {
    return path.join(config.canvasRoot, `pod-${podId}`);
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(podId: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(podId);

    try {
      await fs.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a workspace
   * @returns Array of relative file paths
   */
  async listWorkspaceFiles(podId: string): Promise<Result<string[]>> {
    const workspacePath = this.getWorkspacePath(podId);

    const files = await this.readDirRecursive(workspacePath, workspacePath);
    return ok(files);
  }

  /**
   * Recursively read directory and return all file paths
   */
  private async readDirRecursive(
    dirPath: string,
    basePath: string
  ): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common ignore patterns
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
        // Return relative path from workspace root
        const relativePath = path.relative(basePath, fullPath);
        files.push(relativePath);
      }
    }

    return files;
  }
}

export const workspaceService = new WorkspaceService();
