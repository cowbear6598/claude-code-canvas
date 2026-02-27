import path from 'path';
import fs from 'fs/promises';
import { persistenceService } from './index.js';
import type { Pod, PersistedPod } from '../../types';
import { Result, ok, err } from '../../types';
import { logger } from '../../utils/logger.js';
import { fileExists } from '../shared/fileResourceHelpers.js';

class PodPersistenceService {
  getPodFilePath(canvasDir: string, podId: string): string {
    return path.join(canvasDir, `pod-${podId}`, 'pod.json');
  }

  private toPersistedPod(pod: Pod, claudeSessionId?: string): PersistedPod {
    const persisted: PersistedPod = {
      id: pod.id,
      name: pod.name,
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

    if (pod.schedule) {
      persisted.schedule = {
        ...pod.schedule,
        lastTriggeredAt: pod.schedule.lastTriggeredAt
          ? pod.schedule.lastTriggeredAt.toISOString()
          : null,
      };
    }

    return persisted;
  }

  async savePod(canvasDir: string, pod: Pod, claudeSessionId?: string): Promise<Result<void>> {
    const filePath = this.getPodFilePath(canvasDir, pod.id);
    const persistedPod = this.toPersistedPod(pod, claudeSessionId);

    const result = await persistenceService.writeJson(filePath, persistedPod);
    if (!result.success) {
      return err(`儲存 Pod 失敗 (${pod.id})`);
    }

    return ok(undefined);
  }

  async loadPod(canvasDir: string, podId: string): Promise<PersistedPod | null> {
    const filePath = this.getPodFilePath(canvasDir, podId);
    const result = await persistenceService.readJson<PersistedPod>(filePath);

    if (!result.success) {
      return null;
    }

    return result.data ?? null;
  }

  async deletePodData(canvasDir: string, podId: string): Promise<Result<void>> {
    const filePath = this.getPodFilePath(canvasDir, podId);

    const result = await persistenceService.deleteFile(filePath);
    if (!result.success) {
      return err(`刪除 Pod 資料失敗 (${podId})`);
    }

    return ok(undefined);
  }

  async listAllPodIds(canvasDir: string): Promise<Result<string[]>> {
    const dirResult = await persistenceService.ensureDirectory(canvasDir);
    if (!dirResult.success) {
      return err('列出 Pod 失敗');
    }

    const entries = await fs.readdir(canvasDir, { withFileTypes: true });
    const podIds: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('pod-')) {
        continue;
      }

      const podId = entry.name.substring(4);
      const podFilePath = this.getPodFilePath(canvasDir, podId);
      const exists = await fileExists(podFilePath);

      if (!exists) {
        continue;
      }

      podIds.push(podId);
    }

    logger.log('Startup', 'Load', `[PodPersistence] 在磁碟上找到 ${podIds.length} 個 Pod`);
    return ok(podIds);
  }
}

export const podPersistenceService = new PodPersistenceService();
