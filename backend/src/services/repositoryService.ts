import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from '../config';
import { isPathWithinDirectory } from '../utils/pathValidator.js';
import {fileExists, directoryExists} from './shared/fileResourceHelpers.js';

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const RepositoryMetadataEntrySchema = z.object({
  parentRepoId: z.string().regex(VALID_ID_PATTERN).optional(),
  branchName: z.string().optional(),
  currentBranch: z.string().optional(),
});

const RepositoryMetadataSchema = z.record(
  z.string().regex(VALID_ID_PATTERN),
  RepositoryMetadataEntrySchema
);

type RepositoryMetadata = z.infer<typeof RepositoryMetadataEntrySchema>;

function isValidRepositoryMetadata(value: unknown): value is Record<string, RepositoryMetadata> {
  return RepositoryMetadataSchema.safeParse(value).success;
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
        const repositoryEntry: { id: string; name: string; parentRepoId?: string; branchName?: string; currentBranch?: string } = {
          id: entry.name,
          name: entry.name,
        };

        if (metadata?.parentRepoId) {
          repositoryEntry.parentRepoId = metadata.parentRepoId;
        }
        if (metadata?.branchName) {
          repositoryEntry.branchName = metadata.branchName;
        }
        if (metadata?.currentBranch) {
          repositoryEntry.currentBranch = metadata.currentBranch;
        }

        repositories.push(repositoryEntry);
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
    return directoryExists(repositoryPath);
  }

  getRepositoryPath(repositoryId: string): string {
    const repositoryPath = path.join(config.repositoriesRoot, repositoryId);

    if (!isPathWithinDirectory(repositoryPath, config.repositoriesRoot)) {
      throw new Error('無效的 Repository 路徑');
    }

    return repositoryPath;
  }

  getParentDirectory(): string {
    return config.repositoriesRoot;
  }

  async delete(repositoryId: string): Promise<void> {
    const repositoryPath = this.getRepositoryPath(repositoryId);

    if (!isPathWithinDirectory(repositoryPath, config.repositoriesRoot)) {
      throw new Error(`無效的 Repository 路徑：${repositoryId}`);
    }

    await fs.rm(repositoryPath, { recursive: true, force: true });
    this.metadataStore.delete(repositoryId);
    await this.saveMetadata();
  }
}

export const repositoryService = new RepositoryService();
