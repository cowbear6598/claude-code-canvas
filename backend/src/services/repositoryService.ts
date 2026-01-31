import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { isPathWithinDirectory } from '../utils/pathValidator.js';
import {fileExists} from './shared/fileResourceHelpers.js';

class RepositoryService {
  async list(): Promise<Array<{ id: string; name: string }>> {
    await fs.mkdir(config.repositoriesRoot, { recursive: true });

    const entries = await fs.readdir(config.repositoriesRoot, { withFileTypes: true });
    const repositories: Array<{ id: string; name: string }> = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        repositories.push({
          id: entry.name,
          name: entry.name,
        });
      }
    }

    return repositories;
  }

  async create(name: string): Promise<{ id: string; name: string }> {
    const repositoryPath = path.join(config.repositoriesRoot, name);

    await fs.mkdir(repositoryPath, { recursive: true });

    return { id: name, name };
  }

  async exists(repositoryId: string): Promise<boolean> {
    const repositoryPath = this.getRepositoryPath(repositoryId);
    return fileExists(repositoryPath);
  }

  /**
   * Get the full path of a repository
   */
  getRepositoryPath(repositoryId: string): string {
    return path.join(config.repositoriesRoot, repositoryId);
  }

  /**
   * Delete a repository directory
   */
  async delete(repositoryId: string): Promise<void> {
    const repositoryPath = this.getRepositoryPath(repositoryId);

    if (!isPathWithinDirectory(repositoryPath, config.repositoriesRoot)) {
      throw new Error(`Invalid repository path: ${repositoryId}`);
    }

    await fs.rm(repositoryPath, { recursive: true, force: true });
  }
}

export const repositoryService = new RepositoryService();
