import {WebSocketResponseEvents} from '../../schemas/index.js';
import type {
  WorkflowPendingPayload,
  WorkflowSourcesMergedPayload,
  Connection,
} from '../../types/index.js';
import type { ExecutionServiceMethods } from './types.js';
import {podStore} from '../podStore.js';
import {socketService} from '../socketService.js';
import {pendingTargetStore} from '../pendingTargetStore.js';
import {workflowQueueService} from './workflowQueueService.js';
import {workflowStateService} from './workflowStateService.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries} from './workflowHelpers.js';

class WorkflowMultiInputService {
  private executionService!: ExecutionServiceMethods;

  /**
   * 初始化依賴注入
   */
  init(dependencies: { executionService: ExecutionServiceMethods }): void {
    this.executionService = dependencies.executionService;
  }

  emitPendingStatus(canvasId: string, targetPodId: string): void {
    const pending = pendingTargetStore.getPendingTarget(targetPodId);
    if (!pending) {
      return;
    }

    const completedSourcePodIds = Array.from(pending.completedSources.keys());
    const rejectedSourcePodIds = Array.from(pending.rejectedSources.keys());
    const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
      (id) => !completedSourcePodIds.includes(id) && !rejectedSourcePodIds.includes(id)
    );

    const pendingPayload: WorkflowPendingPayload = {
      canvasId,
      targetPodId,
      completedSourcePodIds,
      pendingSourcePodIds,
      totalSources: pending.requiredSourcePodIds.length,
      completedCount: pending.completedSources.size,
      rejectedSourcePodIds,
      hasRejectedSources: rejectedSourcePodIds.length > 0,
    };

    socketService.emitToCanvas(
      canvasId,
      WebSocketResponseEvents.WORKFLOW_PENDING,
      pendingPayload
    );

    logger.log('Workflow', 'Update', `Target ${targetPodId} waiting: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources complete`);
  }

  async handleMultiInputForConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    requiredSourcePodIds: string[],
    summary: string,
    triggerMode: 'auto' | 'ai-decide'
  ): Promise<void> {
    if (!pendingTargetStore.hasPendingTarget(connection.targetPodId)) {
      workflowStateService.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
    }

    const { allSourcesResponded, hasRejection } = workflowStateService.recordSourceCompletion(
      connection.targetPodId,
      sourcePodId,
      summary
    );

    if (!allSourcesResponded) {
      this.emitPendingStatus(canvasId, connection.targetPodId);
      return;
    }

    if (hasRejection) {
      logger.log('Workflow', 'Update', `Target ${connection.targetPodId} has rejected sources, not triggering`);
      this.emitPendingStatus(canvasId, connection.targetPodId);
      return;
    }

    const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
    if (!completedSummaries) {
      logger.error('Workflow', 'Error', '無法取得已完成的摘要');
      return;
    }

    const mergedContent = formatMergedSummaries(
      completedSummaries,
      (podId) => podStore.getById(canvasId, podId)
    );

    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is ${targetPod.status}, enqueuing merged workflow`);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId: Array.from(completedSummaries.keys())[0],
        targetPodId: connection.targetPodId,
        summary: mergedContent,
        isSummarized: true,
        triggerMode,
      });

      workflowStateService.clearPendingTarget(connection.targetPodId);
      return;
    }

    this.triggerMergedWorkflow(canvasId, connection);
  }

  triggerMergedWorkflow(
    canvasId: string,
    connection: Connection
  ): void {
    logger.log('Workflow', 'Complete', `All sources complete for target ${connection.targetPodId}`);

    const completedSummaries = workflowStateService.getCompletedSummaries(connection.targetPodId);
    if (!completedSummaries) {
      logger.error('Workflow', 'Error', '無法取得已完成的摘要');
      return;
    }

    podStore.setStatus(canvasId, connection.targetPodId, 'chatting');

    const mergedContent = formatMergedSummaries(
      completedSummaries,
      (podId) => podStore.getById(canvasId, podId)
    );
    const mergedPreview = mergedContent.substring(0, 200);

    const sourcePodIds = Array.from(completedSummaries.keys());
    const mergedPayload: WorkflowSourcesMergedPayload = {
      canvasId,
      targetPodId: connection.targetPodId,
      sourcePodIds,
      mergedContentPreview: mergedPreview,
    };

    socketService.emitToCanvas(
      canvasId,
      WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
      mergedPayload
    );

    this.executionService.triggerWorkflowWithSummary(canvasId, connection.id, mergedContent, true).catch((error) => {
      logger.error('Workflow', 'Error', `觸發合併工作流程失敗 ${connection.id}`, error);
      // 恢復 Pod 狀態
      podStore.setStatus(canvasId, connection.targetPodId, 'idle');
    });

    workflowStateService.clearPendingTarget(connection.targetPodId);
  }
}

export const workflowMultiInputService = new WorkflowMultiInputService();
