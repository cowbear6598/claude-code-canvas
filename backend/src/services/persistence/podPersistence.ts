import path from 'path';
import fs from 'fs/promises';
import { persistenceService } from './index.js';
import type { Pod, PersistedPod } from '../../types/index.js';
import { Result, ok, err } from '../../types/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class PodPersistenceService {
  getPodFilePath(podId: string): string {
    return path.join(config.canvasRoot, `pod-${podId}`, 'pod.json');
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
      model: pod.model,
      repositoryId: pod.repositoryId,
      autoClear: pod.autoClear,
      commandId: pod.commandId,
      subAgentIds: pod.subAgentIds,
      needsForkSession: pod.needsForkSession,
    };
  }

  async savePod(pod: Pod, claudeSessionId?: string): Promise<Result<void>> {
    const filePath = this.getPodFilePath(pod.id);
    const persistedPod = this.toPersistedPod(pod, claudeSessionId);

    const result = await persistenceService.writeJson(filePath, persistedPod);
    if (!result.success) {
      return err(`儲存 Pod 失敗 (${pod.id})`);
    }

    return ok(undefined);
  }

  async loadPod(podId: string): Promise<PersistedPod | null> {
    const filePath = this.getPodFilePath(podId);
    const result = await persistenceService.readJson<PersistedPod>(filePath);

    if (!result.success) {
      return null;
    }

    return result.data ?? null;
  }

  async deletePodData(podId: string): Promise<Result<void>> {
    const filePath = this.getPodFilePath(podId);

    const result = await persistenceService.deleteFile(filePath);
    if (!result.success) {
      return err(`刪除 Pod 資料失敗 (${podId})`);
    }

    return ok(undefined);
  }

  async listAllPodIds(): Promise<Result<string[]>> {
    const dirResult = await persistenceService.ensureDirectory(config.canvasRoot);
    if (!dirResult.success) {
      return err('列出 Pod 失敗');
    }

    const entries = await fs.readdir(config.canvasRoot, { withFileTypes: true });
    const podIds: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('pod-')) {
        continue;
      }

      const podId = entry.name.substring(4);
      const podFilePath = this.getPodFilePath(podId);
      const exists = await persistenceService.fileExists(podFilePath);

      if (!exists) {
        continue;
      }

      podIds.push(podId);
    }

    logger.log('Startup', 'Load', `[PodPersistence] Found ${podIds.length} Pods on disk`);
    return ok(podIds);
  }
}

export const podPersistenceService = new PodPersistenceService();
