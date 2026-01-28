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
  /**
   * Get all downstream POD IDs using BFS traversal
   * @param sourcePodId Starting POD ID
   * @returns Array of POD IDs (including the source POD)
   */
  getDownstreamPodIds(sourcePodId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [sourcePodId];
    visited.add(sourcePodId);

    while (queue.length > 0) {
      const currentPodId = queue.shift()!;

      // Find all outgoing connections from current POD
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

  /**
   * Get downstream PODs with their names
   * @param sourcePodId Starting POD ID
   * @returns Array of objects with id and name
   */
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

  /**
   * Clear workflow data for all downstream PODs
   * @param sourcePodId Starting POD ID
   * @returns ClearResult with success status and cleared POD information
   */
  async clearWorkflow(sourcePodId: string): Promise<ClearResult> {
    try {
      const podIds = this.getDownstreamPodIds(sourcePodId);
      const clearedPodNames: string[] = [];

      for (const podId of podIds) {
        const pod = podStore.getById(podId);
        if (pod) {
          clearedPodNames.push(pod.name);

          // Clear messages from memory
          messageStore.clearMessages(podId);

          // Clear chat history from disk
          const clearResult = await chatPersistenceService.clearChatHistory(podId);
          if (!clearResult.success) {
            logger.error('AutoClear', 'Error', `[WorkflowClear] Error clearing chat history for Pod ${podId}: ${clearResult.error}`);
          }

          // Destroy Claude session and clear session ID
          try {
            await claudeSessionManager.destroySession(podId);
            // 清除 Pod 中保存的 session ID，確保下次對話會開始新的 session
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
