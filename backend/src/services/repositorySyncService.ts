import { repositoryService } from './repositoryService.js';
import { podStore } from './podStore.js';
import { canvasStore } from './canvasStore.js';
import { commandService } from './commandService.js';
import { skillService } from './skillService.js';
import { subAgentService } from './subAgentService.js';
import { logger } from '../utils/logger.js';

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

      const commandIds = new Set<string>();
      const skillIds = new Set<string>();
      const subAgentIds = new Set<string>();

      const allCanvases = canvasStore.list();
      for (const canvas of allCanvases) {
        const pods = podStore.findByRepositoryId(canvas.id, repositoryId);

        for (const pod of pods) {
          if (pod.commandId) {
            commandIds.add(pod.commandId);
          }
          for (const skillId of pod.skillIds) {
            skillIds.add(skillId);
          }
          for (const subAgentId of pod.subAgentIds) {
            subAgentIds.add(subAgentId);
          }
        }
      }

      // 同組並行執行 delete 操作
      const deleteResults = await Promise.allSettled([
        commandService.deleteCommandFromPath(repositoryPath),
        skillService.deleteSkillsFromPath(repositoryPath),
        subAgentService.deleteSubAgentsFromPath(repositoryPath),
      ]);

      // 統一記錄失敗的操作
      const deleteNames = ['commands', 'skills', 'subagents'];
      deleteResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error('Repository', 'Update', `Failed to delete ${deleteNames[index]} from ${repositoryPath}`, result.reason);
        }
      });

      for (const commandId of commandIds) {
        try {
          await commandService.copyCommandToRepository(commandId, repositoryPath);
        } catch (error) {
          logger.error('Repository', 'Update', `Failed to copy command ${commandId} to repository ${repositoryId}`, error);
        }
      }

      for (const skillId of skillIds) {
        try {
          await skillService.copySkillToRepository(skillId, repositoryPath);
        } catch (error) {
          logger.error('Repository', 'Update', `Failed to copy skill ${skillId} to repository ${repositoryId}`, error);
        }
      }

      for (const subAgentId of subAgentIds) {
        try {
          await subAgentService.copySubAgentToRepository(subAgentId, repositoryPath);
        } catch (error) {
          logger.error('Repository', 'Update', `Failed to copy subagent ${subAgentId} to repository ${repositoryId}`, error);
        }
      }

      logger.log('Repository', 'Update', `Synced repository ${repositoryId} with ${commandIds.size} commands, ${skillIds.size} skills, ${subAgentIds.size} subagents`);
    } catch (error) {
      logger.error('Repository', 'Update', `Failed to sync repository ${repositoryId}`, error);
      throw error;
    }
  }
}

export const repositorySyncService = new RepositorySyncService();
