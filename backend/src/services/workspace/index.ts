// Workspace Service
// Manages filesystem operations for Pod workspaces

import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../config/index.js';

class WorkspaceService {
  /**
   * Create a workspace directory for a Pod
   * @returns The absolute path to the created workspace
   */
  async createWorkspace(podId: string): Promise<string> {
    const workspacePath = this.getWorkspacePath(podId);

    try {
      await fs.mkdir(workspacePath, { recursive: true });
      console.log(`[Workspace] Created workspace at: ${workspacePath}`);
      return workspacePath;
    } catch (error) {
      console.error(`[Workspace] Failed to create workspace: ${error}`);
      throw new Error(`Failed to create workspace for pod ${podId}`);
    }
  }

  /**
   * Delete a workspace directory
   */
  async deleteWorkspace(podId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(podId);

    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
      console.log(`[Workspace] Deleted workspace at: ${workspacePath}`);
    } catch (error) {
      console.error(`[Workspace] Failed to delete workspace: ${error}`);
      throw new Error(`Failed to delete workspace for pod ${podId}`);
    }
  }

  /**
   * Get workspace path for a Pod
   */
  getWorkspacePath(podId: string): string {
    return path.join(config.workspaceRoot, `pod-${podId}`);
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
  async listWorkspaceFiles(podId: string): Promise<string[]> {
    const workspacePath = this.getWorkspacePath(podId);

    try {
      const files = await this.readDirRecursive(workspacePath, workspacePath);
      return files;
    } catch (error) {
      console.error(`[Workspace] Failed to list files: ${error}`);
      throw new Error(`Failed to list files for pod ${podId}`);
    }
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

// Export singleton instance
export const workspaceService = new WorkspaceService();
