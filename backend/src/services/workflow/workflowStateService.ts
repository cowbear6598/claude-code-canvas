import { connectionStore } from '../connectionStore.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
import { podStore } from '../podStore.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import {
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';

class WorkflowStateService {
  private formatMergedSummaries(summaries: Map<string, string>): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
      const sourcePod = podStore.getById(sourcePodId);
      const podName = sourcePod?.name || sourcePodId;

      formatted.push(`## Source: ${podName}\n${content}\n\n---`);
    }

    let result = formatted.join('\n\n');
    result = result.replace(/\n\n---$/, '');

    return result;
  }

  checkMultiInputScenario(targetPodId: string): { isMultiInput: boolean; requiredSourcePodIds: string[] } {
    const incomingConnections = connectionStore.findByTargetPodId(targetPodId);
    const autoTriggerConnections = incomingConnections.filter((conn) => conn.autoTrigger);
    const requiredSourcePodIds = autoTriggerConnections.map((conn) => conn.sourcePodId);

    return {
      isMultiInput: autoTriggerConnections.length > 1,
      requiredSourcePodIds,
    };
  }

  initializePendingTarget(targetPodId: string, requiredSourcePodIds: string[]): void {
    pendingTargetStore.initializePendingTarget(targetPodId, requiredSourcePodIds);
    logger.log('Workflow', 'Create', `Initialized pending target ${targetPodId}, waiting for ${requiredSourcePodIds.length} sources`);
  }

  recordSourceCompletion(targetPodId: string, sourcePodId: string, summary: string): boolean {
    return pendingTargetStore.recordSourceCompletion(targetPodId, sourcePodId, summary);
  }

  getCompletedSummaries(targetPodId: string): Map<string, string> | null {
    return pendingTargetStore.getCompletedSummaries(targetPodId) || null;
  }

  clearPendingTarget(targetPodId: string): void {
    pendingTargetStore.clearPendingTarget(targetPodId);
  }

  handleSourceDeletion(sourcePodId: string): string[] {
    const affectedTargetIds = pendingTargetStore.removeSourceFromAllPending(sourcePodId);

    for (const targetPodId of affectedTargetIds) {
      const pending = pendingTargetStore.getPendingTarget(targetPodId);
      if (!pending) {
        continue;
      }

      if (pending.requiredSourcePodIds.length === 0) {
        pendingTargetStore.clearPendingTarget(targetPodId);
        logger.log('Workflow', 'Delete', `Cleared pending target ${targetPodId} - no sources remaining`);
        continue;
      }

      const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

      if (!allComplete) {
        this.emitPendingStatus(targetPodId, pending);
        continue;
      }

      logger.log('Workflow', 'Update', `Source deleted, but remaining sources complete for ${targetPodId}`);

      const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
      if (!completedSummaries) {
        continue;
      }

      const mergedContent = this.formatMergedSummaries(completedSummaries);
      const sourcePodIds = Array.from(completedSummaries.keys());

      const mergedPayload: WorkflowSourcesMergedPayload = {
        targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedContent.substring(0, 200),
      };

      workflowEventEmitter.emitWorkflowSourcesMerged(targetPodId, sourcePodIds, mergedPayload);
    }

    return affectedTargetIds;
  }

  handleConnectionDeletion(connectionId: string): void {
    const connection = connectionStore.getById(connectionId);
    if (!connection || !connection.autoTrigger) {
      return;
    }

    const { sourcePodId, targetPodId } = connection;

    if (!pendingTargetStore.hasPendingTarget(targetPodId)) {
      return;
    }

    pendingTargetStore.removeSourceFromPending(targetPodId, sourcePodId);

    const pending = pendingTargetStore.getPendingTarget(targetPodId);
    if (!pending) {
      return;
    }

    if (pending.requiredSourcePodIds.length === 0) {
      pendingTargetStore.clearPendingTarget(targetPodId);
      logger.log('Workflow', 'Delete', `Cleared pending target ${targetPodId} - connection deleted`);
      return;
    }

    const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

    if (!allComplete) {
      this.emitPendingStatus(targetPodId, pending);
      return;
    }

    logger.log('Workflow', 'Update', `Connection deleted, but remaining sources complete for ${targetPodId}`);

    const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
    if (!completedSummaries) {
      return;
    }

    const mergedContent = this.formatMergedSummaries(completedSummaries);
    const sourcePodIds = Array.from(completedSummaries.keys());

    const mergedPayload: WorkflowSourcesMergedPayload = {
      targetPodId,
      sourcePodIds,
      mergedContentPreview: mergedContent.substring(0, 200),
    };

    workflowEventEmitter.emitWorkflowSourcesMerged(targetPodId, sourcePodIds, mergedPayload);
  }

  private emitPendingStatus(targetPodId: string, pending: { requiredSourcePodIds: string[]; completedSources: Map<string, string> }): void {
    const completedSourcePodIds = Array.from(pending.completedSources.keys());
    const pendingSourcePodIds = pending.requiredSourcePodIds.filter(
      (id) => !completedSourcePodIds.includes(id)
    );

    const pendingPayload: WorkflowPendingPayload = {
      targetPodId,
      completedSourcePodIds,
      pendingSourcePodIds,
      totalSources: pending.requiredSourcePodIds.length,
      completedCount: pending.completedSources.size,
    };

    workflowEventEmitter.emitWorkflowPending(targetPodId, pendingPayload);

    logger.log('Workflow', 'Update', `Updated pending target ${targetPodId}: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources`);
  }
}

export const workflowStateService = new WorkflowStateService();
