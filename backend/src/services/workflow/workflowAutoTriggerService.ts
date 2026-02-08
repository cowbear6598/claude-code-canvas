import type {Connection} from '../../types';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {workflowQueueService} from './workflowQueueService.js';
import {workflowStateService} from './workflowStateService.js';
import {logger} from '../../utils/logger.js';

class WorkflowAutoTriggerService {

  getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      logger.error('Workflow', 'Error', 'No assistant messages available for fallback');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }

  async processAutoTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    generateSummary: (canvasId: string, sourcePodId: string, targetPodId: string) => Promise<{ content: string; isSummarized: boolean } | null>,
    handleMultiInput: (canvasId: string, sourcePodId: string, connection: Connection, requiredSourcePodIds: string[], summary: string, triggerMode: 'auto' | 'ai-decide') => Promise<void>,
    triggerInternal: (canvasId: string, connectionId: string) => Promise<void>
  ): Promise<void> {
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (!targetPod) {
      logger.log('Workflow', 'Error', `Target Pod ${connection.targetPodId} not found, skipping auto-trigger`);
      return;
    }

    const { isMultiInput, requiredSourcePodIds } = workflowStateService.checkMultiInputScenario(
      canvasId,
      connection.targetPodId
    );

    if (isMultiInput) {
      const result = await generateSummary(canvasId, sourcePodId, connection.targetPodId);
      if (!result) {
        return;
      }
      await handleMultiInput(
        canvasId,
        sourcePodId,
        connection,
        requiredSourcePodIds,
        result.content,
        'auto'
      );
      return;
    }

    if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${targetPod.status}, enqueuing auto-trigger`);

      const result = await generateSummary(canvasId, sourcePodId, connection.targetPodId);
      if (!result) {
        return;
      }

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId,
        targetPodId: connection.targetPodId,
        summary: result.content,
        isSummarized: true,
        triggerMode: 'auto',
      });
      return;
    }

    triggerInternal(canvasId, connection.id).catch((error) => {
      logger.error('Workflow', 'Error', `Failed to auto-trigger workflow ${connection.id}`, error);
    });
  }
}

export const workflowAutoTriggerService = new WorkflowAutoTriggerService();
