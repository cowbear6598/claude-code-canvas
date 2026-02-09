import { connectionStore } from '../connectionStore.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
import { podStore } from '../podStore.js';
import { directTriggerStore } from '../directTriggerStore.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import {
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';

class WorkflowStateService {
  private formatMergedSummaries(canvasId: string, summaries: Map<string, string>): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
      const sourcePod = podStore.getById(canvasId, sourcePodId);
      const podName = sourcePod?.name || sourcePodId;

      formatted.push(`## Source: ${podName}\n${content}\n\n---`);
    }

    let result = formatted.join('\n\n');
    result = result.replace(/\n\n---$/, '');

    return result;
  }

  checkMultiInputScenario(canvasId: string, targetPodId: string): { isMultiInput: boolean; requiredSourcePodIds: string[] } {
    const incomingConnections = connectionStore.findByTargetPodId(canvasId, targetPodId);
    const triggerableConnections = incomingConnections.filter((conn) => conn.triggerMode === 'auto' || conn.triggerMode === 'ai-decide');
    const requiredSourcePodIds = triggerableConnections.map((conn) => conn.sourcePodId);

    return {
      isMultiInput: triggerableConnections.length > 1,
      requiredSourcePodIds,
    };
  }

  getDirectConnectionCount(canvasId: string, targetPodId: string): number {
    const incomingConnections = connectionStore.findByTargetPodId(canvasId, targetPodId);
    return incomingConnections.filter((conn) => conn.triggerMode === 'direct').length;
  }

  initializePendingTarget(targetPodId: string, requiredSourcePodIds: string[]): void {
    pendingTargetStore.initializePendingTarget(targetPodId, requiredSourcePodIds);
    logger.log('Workflow', 'Create', `Initialized pending target ${targetPodId}, waiting for ${requiredSourcePodIds.length} sources`);
  }

  recordSourceCompletion(targetPodId: string, sourcePodId: string, summary: string): { allSourcesResponded: boolean; hasRejection: boolean } {
    return pendingTargetStore.recordSourceCompletion(targetPodId, sourcePodId, summary);
  }

  recordSourceRejection(targetPodId: string, sourcePodId: string, reason: string): void {
    pendingTargetStore.recordSourceRejection(targetPodId, sourcePodId, reason);
  }

  hasAnyRejectedSource(targetPodId: string): boolean {
    return pendingTargetStore.hasAnyRejectedSource(targetPodId);
  }

  getCompletedSummaries(targetPodId: string): Map<string, string> | null {
    return pendingTargetStore.getCompletedSummaries(targetPodId) || null;
  }

  clearPendingTarget(targetPodId: string): void {
    pendingTargetStore.clearPendingTarget(targetPodId);
  }

  handleSourceDeletion(canvasId: string, sourcePodId: string): string[] {
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
        this.emitPendingStatus(canvasId, targetPodId, pending);
        continue;
      }

      logger.log('Workflow', 'Update', `Source deleted, but remaining sources complete for ${targetPodId}`);

      const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
      if (!completedSummaries) {
        continue;
      }

      const mergedContent = this.formatMergedSummaries(canvasId, completedSummaries);
      const sourcePodIds = Array.from(completedSummaries.keys());

      const mergedPayload: WorkflowSourcesMergedPayload = {
        canvasId,
        targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedContent.substring(0, 200),
      };

      workflowEventEmitter.emitWorkflowSourcesMerged(canvasId, targetPodId, sourcePodIds, mergedPayload);
    }

    return affectedTargetIds;
  }

  handleConnectionDeletion(canvasId: string, connectionId: string): void {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      return;
    }

    const { sourcePodId, targetPodId, triggerMode } = connection;

    if (triggerMode === 'direct') {
      if (directTriggerStore.hasDirectPending(targetPodId)) {
        directTriggerStore.clearDirectPending(targetPodId);
        logger.log('Workflow', 'Delete', `Cleared direct pending for target ${targetPodId} - connection deleted`);
      }
      return;
    }

    if (triggerMode !== 'auto' && triggerMode !== 'ai-decide') {
      return;
    }

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
      this.emitPendingStatus(canvasId, targetPodId, pending);
      return;
    }

    logger.log('Workflow', 'Update', `Connection deleted, but remaining sources complete for ${targetPodId}`);

    const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
    if (!completedSummaries) {
      return;
    }

    const mergedContent = this.formatMergedSummaries(canvasId, completedSummaries);
    const sourcePodIds = Array.from(completedSummaries.keys());

    const mergedPayload: WorkflowSourcesMergedPayload = {
      canvasId,
      targetPodId,
      sourcePodIds,
      mergedContentPreview: mergedContent.substring(0, 200),
    };

    workflowEventEmitter.emitWorkflowSourcesMerged(canvasId, targetPodId, sourcePodIds, mergedPayload);
  }

  private emitPendingStatus(canvasId: string, targetPodId: string, pending: { requiredSourcePodIds: string[]; completedSources: Map<string, string>; rejectedSources: Map<string, string> }): void {
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

    workflowEventEmitter.emitWorkflowPending(canvasId, targetPodId, pendingPayload);

    logger.log('Workflow', 'Update', `Updated pending target ${targetPodId}: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources`);
  }
}

export const workflowStateService = new WorkflowStateService();
