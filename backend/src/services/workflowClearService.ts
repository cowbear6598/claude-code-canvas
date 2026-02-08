import { connectionStore } from './connectionStore.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { chatPersistenceService } from './persistence/chatPersistence.js';
import { claudeSessionManager } from './claude/sessionManager.js';
import { canvasStore } from './canvasStore.js';
import { logger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errorHelpers.js';

interface ClearResult {
  success: boolean;
  clearedPodIds: string[];
  clearedPodNames: string[];
  clearedConnectionIds: string[];
  error?: string;
}

class WorkflowClearService {
  getDownstreamPodIds(canvasId: string, sourcePodId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [sourcePodId];
    visited.add(sourcePodId);

    while (queue.length > 0) {
      const currentPodId = queue.shift()!;

      const connections = connectionStore.findBySourcePodId(canvasId, currentPodId);

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

  getDownstreamPods(canvasId: string, sourcePodId: string): Array<{ id: string; name: string }> {
    const podIds = this.getDownstreamPodIds(canvasId, sourcePodId);
    const pods: Array<{ id: string; name: string }> = [];

    for (const podId of podIds) {
      const pod = podStore.getById(canvasId, podId);
      if (pod) {
        pods.push({
          id: pod.id,
          name: pod.name,
        });
      }
    }

    return pods;
  }

  async clearWorkflow(canvasId: string, sourcePodId: string): Promise<ClearResult> {
    try {
      const canvasDir = canvasStore.getCanvasDir(canvasId);
      if (!canvasDir) {
        return {
          success: false,
          clearedPodIds: [],
          clearedPodNames: [],
          clearedConnectionIds: [],
          error: `Canvas not found: ${canvasId}`,
        };
      }

      const podIds = this.getDownstreamPodIds(canvasId, sourcePodId);
      const clearedPodNames: string[] = [];
      const clearedConnectionIds: string[] = [];

      for (const podId of podIds) {
        const pod = podStore.getById(canvasId, podId);
        if (pod) {
          clearedPodNames.push(pod.name);

          messageStore.clearMessages(podId);

          const clearResult = await chatPersistenceService.clearChatHistory(canvasDir, podId);
          if (!clearResult.success) {
            logger.error('AutoClear', 'Error', `[WorkflowClear] Error clearing chat history for Pod ${podId}: ${clearResult.error}`);
          }

          await claudeSessionManager
            .destroySession(podId)
            .then(() => {
              podStore.setClaudeSessionId(canvasId, podId, '');
            })
            .catch((error) => {
              logger.error('AutoClear', 'Error', `[WorkflowClear] Error destroying session for Pod ${podId}`, error);
            });

          // 清除該 Pod 所有出站 ai-decide connections 的 decideStatus
          const outgoingConnections = connectionStore.findBySourcePodId(canvasId, podId);
          for (const conn of outgoingConnections) {
            if (conn.triggerMode === 'ai-decide' && conn.decideStatus !== 'none') {
              connectionStore.updateDecideStatus(canvasId, conn.id, 'none', null);
              clearedConnectionIds.push(conn.id);
            }
          }
        }
      }

      return {
        success: true,
        clearedPodIds: podIds,
        clearedPodNames,
        clearedConnectionIds,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('AutoClear', 'Error', `[WorkflowClear] Failed to clear workflow: ${errorMessage}`);

      return {
        success: false,
        clearedPodIds: [],
        clearedPodNames: [],
        clearedConnectionIds: [],
        error: errorMessage,
      };
    }
  }
}

export const workflowClearService = new WorkflowClearService();
