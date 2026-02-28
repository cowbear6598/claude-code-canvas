import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config';
import { isPathWithinDirectory } from '../utils/pathValidator.js';
import {fileExists} from './shared/fileResourceHelpers.js';

interface RepositoryMetadata {
  parentRepoId?: string;
  branchName?: string;
  currentBranch?: string;
}

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isValidRepositoryMetadata(value: unknown): value is Record<string, RepositoryMetadata> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  for (const [key, metadata] of Object.entries(value as Record<string, unknown>)) {
    if (!VALID_ID_PATTERN.test(key)) {
      return false;
    }

    if (typeof metadata !== 'object' || metadata === null) {
      return false;
    }

    const m = metadata as Record<string, unknown>;

    if (m.parentRepoId !== undefined && (typeof m.parentRepoId !== 'string' || !VALID_ID_PATTERN.test(m.parentRepoId))) {
      return false;
    }

    if (m.branchName !== undefined && typeof m.branchName !== 'string') {
      return false;
    }

    if (m.currentBranch !== undefined && typeof m.currentBranch !== 'string') {
      return false;
    }
  }

  return true;
}

class RepositoryService {
  private metadataStore: Map<string, RepositoryMetadata> = new Map();
  private metadataPath = path.join(config.repositoriesRoot, '.metadata.json');

  async initialize(): Promise<void> {
    await this.loadMetadata();
  }

  private async saveMetadata(): Promise<void> {
    const data = Object.fromEntries(this.metadataStore);
    await fs.writeFile(this.metadataPath, JSON.stringify(data, null, 2));
  }

  private async loadMetadata(): Promise<void> {
    if (!await fileExists(this.metadataPath)) {
      this.metadataStore = new Map();
      return;
    }

    const content = await fs.readFile(this.metadataPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    if (!isValidRepositoryMetadata(parsed)) {
      this.metadataStore = new Map();
      return;
    }

    this.metadataStore = new Map(Object.entries(parsed));
  }

  async list(): Promise<Array<{ id: string; name: string; parentRepoId?: string; branchName?: string; currentBranch?: string }>> {
    await fs.mkdir(config.repositoriesRoot, { recursive: true });

    const entries = await fs.readdir(config.repositoriesRoot, { withFileTypes: true });
    const repositories: Array<{ id: string; name: string; parentRepoId?: string; branchName?: string; currentBranch?: string }> = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadata = this.metadataStore.get(entry.name);
        repositories.push({
          id: entry.name,
          name: entry.name,
          ...(metadata?.parentRepoId && { parentRepoId: metadata.parentRepoId }),
          ...(metadata?.branchName && { branchName: metadata.branchName }),
          ...(metadata?.currentBranch && { currentBranch: metadata.currentBranch }),
        });
      }
    }

    return repositories;
  }

  async create(name: string, options?: { parentRepoId?: string; branchName?: string }): Promise<{ id: string; name: string }> {
    const repositoryPath = path.join(config.repositoriesRoot, name);

    if (!isPathWithinDirectory(repositoryPath, config.repositoriesRoot)) {
      throw new Error('無效的 Repository 路徑');
    }

    await fs.mkdir(repositoryPath, { recursive: true });

    if (options?.parentRepoId || options?.branchName) {
      this.metadataStore.set(name, {
        parentRepoId: options.parentRepoId,
        branchName: options.branchName,
      });
    }

    return { id: name, name };
  }

  getMetadata(repositoryId: string): RepositoryMetadata | undefined {
    return this.metadataStore.get(repositoryId);
  }

  async registerMetadata(repositoryId: string, metadata: RepositoryMetadata): Promise<void> {
    this.metadataStore.set(repositoryId, metadata);
    await this.saveMetadata();
  }

  async exists(repositoryId: string): Promise<boolean> {
    const repositoryPath = this.getRepositoryPath(repositoryId);
    return fileExists(repositoryPath);
  }

  getRepositoryPath(repositoryId: string): string {
    return path.join(config.repositoriesRoot, repositoryId);
  }

  getParentDirectory(): string {
    return config.repositoriesRoot;
  }

  async delete(repositoryId: string): Promise<void> {
    const repositoryPath = this.getRepositoryPath(repositoryId);

    if (!isPathWithinDirectory(repositoryPath, config.repositoriesRoot)) {
      throw new Error(`Invalid repository path: ${repositoryId}`);
    }

    await fs.rm(repositoryPath, { recursive: true, force: true });
    this.metadataStore.delete(repositoryId);
    await this.saveMetadata();
  }
}

export const repositoryService = new RepositoryService();
