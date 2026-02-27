import {WebSocketResponseEvents} from '../../schemas/index.js';
import type {
  WorkflowSourcesMergedPayload,
  Connection,
  TriggerMode,
} from '../../types/index.js';
import type { ExecutionServiceMethods, TriggerStrategy } from './types.js';
import {podStore} from '../podStore.js';
import {socketService} from '../socketService.js';
import {pendingTargetStore} from '../pendingTargetStore.js';
import {workflowQueueService} from './workflowQueueService.js';
import {workflowStateService} from './workflowStateService.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries} from './workflowHelpers.js';
import {autoClearService} from '../autoClear/autoClearService.js';

class WorkflowMultiInputService {
  private executionService!: ExecutionServiceMethods;
  private strategies?: { auto: TriggerStrategy; direct: TriggerStrategy; 'ai-decide': TriggerStrategy };

  private getStrategy(triggerMode: TriggerMode): TriggerStrategy {
    if (!this.strategies) {
      throw new Error('WorkflowMultiInputService 尚未初始化');
    }
    return this.strategies[triggerMode];
  }

  /**
   * 初始化依賴注入
   */
  init(dependencies: {
    executionService: ExecutionServiceMethods;
    strategies: { auto: TriggerStrategy; direct: TriggerStrategy; 'ai-decide': TriggerStrategy };
  }): void {
    this.executionService = dependencies.executionService;
    this.strategies = dependencies.strategies;
  }

  private isTargetPodBusy(targetPod: ReturnType<typeof podStore.getById>): boolean {
    return !!targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing');
  }

  private enqueueIfBusy(
    canvasId: string,
    connection: Connection,
    completedSummaries: Map<string, string>,
    mergedContent: string,
    triggerMode: 'auto' | 'ai-decide'
  ): void {
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    logger.log('Workflow', 'Update', `Target Pod "${targetPod?.name ?? connection.targetPodId}" is busy, enqueuing merged workflow`);

    workflowQueueService.enqueue({
      canvasId,
      connectionId: connection.id,
      sourcePodId: Array.from(completedSummaries.keys())[0],
      targetPodId: connection.targetPodId,
      summary: mergedContent,
      isSummarized: true,
      triggerMode,
    });

    pendingTargetStore.clearPendingTarget(connection.targetPodId);
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
      pendingTargetStore.initializePendingTarget(connection.targetPodId, requiredSourcePodIds);
    }

    const { allSourcesResponded, hasRejection } = pendingTargetStore.recordSourceCompletion(
      connection.targetPodId,
      sourcePodId,
      summary
    );

    if (!allSourcesResponded) {
      workflowStateService.emitPendingStatus(canvasId, connection.targetPodId);
      return;
    }

    if (hasRejection) {
      const targetPod = podStore.getById(canvasId, connection.targetPodId);
      logger.log('Workflow', 'Update', `Target "${targetPod?.name ?? connection.targetPodId}" has rejected sources, not triggering`);
      workflowStateService.emitPendingStatus(canvasId, connection.targetPodId);
      await autoClearService.onGroupNotTriggered(canvasId, connection.targetPodId);
      return;
    }

    const completedSummaries = pendingTargetStore.getCompletedSummaries(connection.targetPodId);
    if (!completedSummaries) {
      logger.error('Workflow', 'Error', '無法取得已完成的摘要');
      return;
    }

    const mergedContent = formatMergedSummaries(
      completedSummaries,
      (podId) => podStore.getById(canvasId, podId)
    );

    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (this.isTargetPodBusy(targetPod)) {
      this.enqueueIfBusy(canvasId, connection, completedSummaries, mergedContent, triggerMode);
      return;
    }

    this.triggerMergedWorkflow(canvasId, connection, triggerMode);
  }

  triggerMergedWorkflow(
    canvasId: string,
    connection: Connection,
    triggerMode: 'auto' | 'ai-decide'
  ): void {
    const completedSummaries = pendingTargetStore.getCompletedSummaries(connection.targetPodId);
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

    const strategy = this.getStrategy(triggerMode);
    this.executionService.triggerWorkflowWithSummary(canvasId, connection.id, mergedContent, true, strategy).catch((error) => {
      logger.error('Workflow', 'Error', `觸發合併工作流程失敗 ${connection.id}`, error);
      podStore.setStatus(canvasId, connection.targetPodId, 'idle');
    });

    pendingTargetStore.clearPendingTarget(connection.targetPodId);
  }
}

export const workflowMultiInputService = new WorkflowMultiInputService();
