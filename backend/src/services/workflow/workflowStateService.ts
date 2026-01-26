import { connectionStore } from '../connectionStore.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
import { socketService } from '../socketService.js';
import {
  WebSocketResponseEvents,
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
} from '../../types/index.js';
import { workflowContentFormatter } from './workflowContentFormatter.js';

class WorkflowStateService {
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
    console.log(
      `[WorkflowState] Initialized pending target ${targetPodId}, waiting for ${requiredSourcePodIds.length} sources`
    );
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
        console.log(`[WorkflowState] Cleared pending target ${targetPodId} - no sources remaining`);
        continue;
      }

      const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

      if (allComplete) {
        console.log(`[WorkflowState] Source deleted, but remaining sources complete for ${targetPodId}`);

        const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
        if (!completedSummaries) {
          continue;
        }

        const mergedContent = workflowContentFormatter.formatMergedSummaries(completedSummaries);
        const sourcePodIds = Array.from(completedSummaries.keys());

        const mergedPayload: WorkflowSourcesMergedPayload = {
          targetPodId,
          sourcePodIds,
          mergedContentPreview: mergedContent.substring(0, 200),
        };

        socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED, mergedPayload);
      } else {
        this.emitPendingStatus(targetPodId, pending);
      }
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
      console.log(`[WorkflowState] Cleared pending target ${targetPodId} - connection deleted`);
      return;
    }

    const allComplete = pending.completedSources.size >= pending.requiredSourcePodIds.length;

    if (allComplete) {
      console.log(`[WorkflowState] Connection deleted, but remaining sources complete for ${targetPodId}`);

      const completedSummaries = pendingTargetStore.getCompletedSummaries(targetPodId);
      if (!completedSummaries) {
        return;
      }

      const mergedContent = workflowContentFormatter.formatMergedSummaries(completedSummaries);
      const sourcePodIds = Array.from(completedSummaries.keys());

      const mergedPayload: WorkflowSourcesMergedPayload = {
        targetPodId,
        sourcePodIds,
        mergedContentPreview: mergedContent.substring(0, 200),
      };

      socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED, mergedPayload);
    } else {
      this.emitPendingStatus(targetPodId, pending);
    }
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

    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_PENDING, pendingPayload);

    console.log(
      `[WorkflowState] Updated pending target ${targetPodId}: ${pending.completedSources.size}/${pending.requiredSourcePodIds.length} sources`
    );
  }
}

export const workflowStateService = new WorkflowStateService();
