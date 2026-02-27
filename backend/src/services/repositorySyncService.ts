import fs from 'node:fs/promises';
import path from 'node:path';
import { repositoryService } from './repositoryService.js';
import { podStore } from './podStore.js';
import { canvasStore } from './canvasStore.js';
import { commandService } from './commandService.js';
import { skillService } from './skillService.js';
import { subAgentService } from './subAgentService.js';
import { podManifestService } from './podManifestService.js';
import { logger } from '../utils/logger.js';
import { fsOperation } from '../utils/operationHelpers.js';
import { validatePodId } from '../utils/pathValidator.js';

interface PodResources {
  commandIds: string[];
  skillIds: string[];
  subAgentIds: string[];
}

class RepositorySyncService {
  private locks: Map<string, Promise<void>> = new Map();

  async syncRepositoryResources(repositoryId: string): Promise<void> {
    const existingLock = this.locks.get(repositoryId);
    if (existingLock) {
      await existingLock;
      const newLock = this.locks.get(repositoryId);
      if (newLock && newLock !== existingLock) {
        await newLock;
      }
      return;
    }

    const syncPromise = this.performSync(repositoryId);
    this.locks.set(repositoryId, syncPromise);

    try {
      await syncPromise;
    } finally {
      if (this.locks.get(repositoryId) === syncPromise) {
        this.locks.delete(repositoryId);
      }
    }
  }

  private async performSync(repositoryId: string): Promise<void> {
    try {
      const repositoryPath = repositoryService.getRepositoryPath(repositoryId);

      // 按 Pod 分組收集資源
      const podResourcesMap = new Map<string, PodResources>();

      const allCanvases = canvasStore.list();
      for (const canvas of allCanvases) {
        const pods = podStore.findByRepositoryId(canvas.id, repositoryId);

        for (const pod of pods) {
          const resources: PodResources = {
            commandIds: pod.commandId ? [pod.commandId] : [],
            skillIds: [...pod.skillIds],
            subAgentIds: [...pod.subAgentIds],
          };
          podResourcesMap.set(pod.id, resources);
        }
      }

      // 清理孤兒 manifest（已不再綁定此 repo 的 Pod）
      await this.cleanOrphanManifests(repositoryPath, podResourcesMap);

      // 對每個綁定此 repo 的 Pod，先刪除之前管理的檔案，再複製新資源並寫入新 manifest
      for (const [podId, resources] of podResourcesMap) {
        await podManifestService.deleteManagedFiles(repositoryPath, podId);

        for (const commandId of resources.commandIds) {
          await fsOperation(
            () => commandService.copyCommandToRepository(commandId, repositoryPath),
            `複製 command ${commandId} 到 repository ${repositoryId} 失敗`
          );
        }

        for (const skillId of resources.skillIds) {
          await fsOperation(
            () => skillService.copySkillToRepository(skillId, repositoryPath),
            `複製 skill ${skillId} 到 repository ${repositoryId} 失敗`
          );
        }

        for (const subAgentId of resources.subAgentIds) {
          await fsOperation(
            () => subAgentService.copySubAgentToRepository(subAgentId, repositoryPath),
            `複製 subagent ${subAgentId} 到 repository ${repositoryId} 失敗`
          );
        }

        // 收集此 Pod 所有已複製的檔案路徑，寫入新的 manifest
        const managedFiles = await this.collectPodManagedFiles(resources);
        await podManifestService.writeManifest(repositoryPath, podId, managedFiles);
      }

      const totalCommands = [...podResourcesMap.values()].reduce((sum, r) => sum + r.commandIds.length, 0);
      const totalSkills = [...podResourcesMap.values()].reduce((sum, r) => sum + r.skillIds.length, 0);
      const totalSubAgents = [...podResourcesMap.values()].reduce((sum, r) => sum + r.subAgentIds.length, 0);

      logger.log('Repository', 'Update', `Synced repository ${repositoryId} with ${totalCommands} commands, ${totalSkills} skills, ${totalSubAgents} subagents`);
    } catch (error) {
      logger.error('Repository', 'Update', `同步 repository ${repositoryId} 失敗`, error);
      throw error;
    }
  }

  private async cleanOrphanManifests(repositoryPath: string, activePodResourcesMap: Map<string, PodResources>): Promise<void> {
    const claudeDir = path.join(repositoryPath, '.claude');

    let fileNames: string[];
    try {
      fileNames = await fs.readdir(claudeDir);
    } catch {
      // .claude 目錄不存在，無需清理
      return;
    }

    const manifestPattern = /^\.pod-manifest-(.+)\.json$/;

    for (const fileName of fileNames) {
      const match = fileName.match(manifestPattern);
      if (!match) {
        continue;
      }

      const orphanPodId = match[1];
      if (activePodResourcesMap.has(orphanPodId)) {
        continue;
      }

      if (!validatePodId(orphanPodId)) {
        logger.warn('Repository', 'Warn', `孤兒 manifest 的 podId 格式無效，跳過：${orphanPodId}`);
        continue;
      }

      await podManifestService.deleteManagedFiles(repositoryPath, orphanPodId);
    }
  }

  private async collectPodManagedFiles(resources: PodResources): Promise<string[]> {
    const files: string[] = [];

    for (const commandId of resources.commandIds) {
      files.push(...podManifestService.collectCommandFiles(commandId));
    }

    for (const skillId of resources.skillIds) {
      const skillSourcePath = skillService.getSkillDirectoryPath(skillId);
      const skillFiles = await podManifestService.collectSkillFiles(skillId, skillSourcePath);
      files.push(...skillFiles);
    }

    for (const subAgentId of resources.subAgentIds) {
      files.push(...podManifestService.collectSubAgentFiles(subAgentId));
    }

    return files;
  }
}

export const repositorySyncService = new RepositorySyncService();
