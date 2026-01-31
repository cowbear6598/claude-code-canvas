import { connectionStore } from './connectionStore.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { chatPersistenceService } from './persistence/chatPersistence.js';
import { claudeSessionManager } from './claude/sessionManager.js';
import { logger } from '../utils/logger.js';

export interface ClearResult {
  success: boolean;
  clearedPodIds: string[];
  clearedPodNames: string[];
  error?: string;
}

class WorkflowClearService {
  getDownstreamPodIds(sourcePodId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [sourcePodId];
    visited.add(sourcePodId);

    while (queue.length > 0) {
      const currentPodId = queue.shift()!;

      const connections = connectionStore.findBySourcePodId(currentPodId);

      for (const connection of connections) {
        const targetPodId = connection.targetPodId;

        if (!visited.has(targetPodId)) {
          visited.add(targetPodId);
          queue.push(targetPodId);
        }
      }
    }

    return Array.from(visited);
  }

  getDownstreamPods(sourcePodId: string): Array<{ id: string; name: string }> {
    const podIds = this.getDownstreamPodIds(sourcePodId);
    const pods: Array<{ id: string; name: string }> = [];

    for (const podId of podIds) {
      const pod = podStore.getById(podId);
      if (pod) {
        pods.push({
          id: pod.id,
          name: pod.name,
        });
      }
    }

    return pods;
  }

  async clearWorkflow(sourcePodId: string): Promise<ClearResult> {
    try {
      const podIds = this.getDownstreamPodIds(sourcePodId);
      const clearedPodNames: string[] = [];

      for (const podId of podIds) {
        const pod = podStore.getById(podId);
        if (pod) {
          clearedPodNames.push(pod.name);

          messageStore.clearMessages(podId);

          const clearResult = await chatPersistenceService.clearChatHistory(podId);
          if (!clearResult.success) {
            logger.error('AutoClear', 'Error', `[WorkflowClear] Error clearing chat history for Pod ${podId}: ${clearResult.error}`);
          }

          try {
            await claudeSessionManager.destroySession(podId);
            podStore.setClaudeSessionId(podId, '');
          } catch (error) {
            logger.error('AutoClear', 'Error', `[WorkflowClear] Error destroying session for Pod ${podId}`, error);
          }
        }
      }

      return {
        success: true,
        clearedPodIds: podIds,
        clearedPodNames,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('AutoClear', 'Error', `[WorkflowClear] Failed to clear workflow: ${errorMessage}`);

      return {
        success: false,
        clearedPodIds: [],
        clearedPodNames: [],
        error: errorMessage,
      };
    }
  }
}

export const workflowClearService = new WorkflowClearService();
