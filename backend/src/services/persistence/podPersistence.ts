import path from 'path';
import fs from 'fs/promises';
import { persistenceService } from './index.js';
import type { Pod, PersistedPod } from '../../types/index.js';
import { config } from '../../config/index.js';

class PodPersistenceService {
  getPodFilePath(podId: string): string {
    return path.join(config.workspaceRoot, `pod-${podId}`, 'pod.json');
  }

  private toPersistedPod(pod: Pod, claudeSessionId?: string): PersistedPod {
    return {
      id: pod.id,
      name: pod.name,
      type: pod.type,
      color: pod.color,
      status: pod.status,
      gitUrl: pod.gitUrl,
      createdAt: pod.createdAt.toISOString(),
      updatedAt: pod.lastActiveAt.toISOString(),
      x: pod.x,
      y: pod.y,
      rotation: pod.rotation,
      claudeSessionId: claudeSessionId ?? pod.claudeSessionId ?? null,
      outputStyleId: pod.outputStyleId,
      skillIds: pod.skillIds,
    };
  }

  async savePod(pod: Pod, claudeSessionId?: string): Promise<void> {
    const filePath = this.getPodFilePath(pod.id);
    const persistedPod = this.toPersistedPod(pod, claudeSessionId);

    try {
      await persistenceService.writeJson(filePath, persistedPod);
      console.log(`[PodPersistence] Saved Pod ${pod.id} to ${filePath}`);
    } catch (error) {
      console.error(`[PodPersistence] Failed to save Pod ${pod.id}: ${error}`);
      throw error;
    }
  }

  async loadPod(podId: string): Promise<PersistedPod | null> {
    const filePath = this.getPodFilePath(podId);
    const data = await persistenceService.readJson<PersistedPod>(filePath);

    if (data) {
      console.log(`[PodPersistence] Loaded Pod ${podId}`);
    }

    return data;
  }

  async deletePodData(podId: string): Promise<void> {
    const filePath = this.getPodFilePath(podId);

    try {
      await persistenceService.deleteFile(filePath);
      console.log(`[PodPersistence] Deleted Pod data ${filePath}`);
    } catch (error) {
      console.error(`[PodPersistence] Failed to delete Pod data ${podId}: ${error}`);
      throw error;
    }
  }

  async listAllPodIds(): Promise<string[]> {
    try {
      await persistenceService.ensureDirectory(config.workspaceRoot);
      const entries = await fs.readdir(config.workspaceRoot, { withFileTypes: true });
      const podIds: string[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('pod-')) {
          continue;
        }

        const podId = entry.name.substring(4);
        const podFilePath = this.getPodFilePath(podId);
        const exists = await persistenceService.fileExists(podFilePath);

        if (!exists) {
          console.warn(`[PodPersistence] Found orphan workspace directory: ${entry.name}`);
          continue;
        }

        podIds.push(podId);
      }

      console.log(`[PodPersistence] Found ${podIds.length} Pods on disk`);
      return podIds;
    } catch (error) {
      console.error(`[PodPersistence] Failed to list Pod IDs: ${error}`);
      return [];
    }
  }
}

export const podPersistenceService = new PodPersistenceService();
