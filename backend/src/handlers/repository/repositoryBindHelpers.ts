import type { Socket } from 'socket.io';
import type { Pod } from '../../types/index.js';
import { WebSocketResponseEvents } from '../../types/index.js';
import { skillService } from '../../services/skillService.js';
import { subAgentService } from '../../services/subAgentService.js';
import { commandService } from '../../services/commandService.js';
import { messageStore } from '../../services/messageStore.js';
import { logger } from '../../utils/logger.js';

export async function cleanupOldRepositoryResources(oldCwd: string): Promise<void> {
  try {
    await skillService.deleteSkillsFromPath(oldCwd);
  } catch (error) {
    logger.error('Repository', 'Delete', `Failed to delete old skills from ${oldCwd}`, error);
  }

  try {
    await subAgentService.deleteSubAgentsFromPath(oldCwd);
  } catch (error) {
    logger.error('Repository', 'Delete', `Failed to delete old subagents from ${oldCwd}`, error);
  }

  try {
    await commandService.deleteCommandFromPath(oldCwd);
  } catch (error) {
    logger.error('Repository', 'Delete', `Failed to delete old commands from ${oldCwd}`, error);
  }
}

export async function copyResourcesToNewPath(
  pod: Pod,
  targetPath: string,
  isRepository: boolean
): Promise<void> {
  for (const skillId of pod.skillIds) {
    try {
      if (isRepository) {
        await skillService.copySkillToRepository(skillId, targetPath);
      } else {
        await skillService.copySkillToRepository(skillId, targetPath);
      }
    } catch (error) {
      const destination = isRepository ? 'repository' : 'workspace';
      logger.error('Repository', 'Error', `Failed to copy skill ${skillId} to ${destination}`, error);
    }
  }

  for (const subAgentId of pod.subAgentIds) {
    try {
      if (isRepository) {
        await subAgentService.copySubAgentToRepository(subAgentId, targetPath);
      } else {
        await subAgentService.copySubAgentToRepository(subAgentId, targetPath);
      }
    } catch (error) {
      const destination = isRepository ? 'repository' : 'workspace';
      logger.error('Repository', 'Error', `Failed to copy subagent ${subAgentId} to ${destination}`, error);
    }
  }

  if (pod.commandId) {
    try {
      await commandService.copyCommandToRepository(pod.commandId, targetPath);
    } catch (error) {
      const destination = isRepository ? 'repository' : 'workspace';
      logger.error('Repository', 'Error', `Failed to copy command ${pod.commandId} to ${destination}`, error);
    }
  }
}

export async function clearPodMessages(socket: Socket, podId: string): Promise<void> {
  try {
    await messageStore.clearMessagesWithPersistence(podId);
    socket.emit(WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
  } catch (error) {
    logger.error('Repository', 'Error', `Failed to clear messages for Pod ${podId}`, error);
  }
}
