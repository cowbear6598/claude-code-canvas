import { connectionStore } from '../connectionStore.js';
import { podStore } from '../podStore.js';
import { workflowClearService } from '../workflowClearService.js';
import { socketService } from '../socketService.js';
import { terminalPodTracker } from './terminalPodTracker.js';
import { WebSocketResponseEvents } from '../../types/index.js';

class AutoClearService {
  /**
   * Find all terminal PODs (PODs without outgoing auto-trigger connections)
   * using BFS traversal from the source POD
   */
  findTerminalPods(sourcePodId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [sourcePodId];
    const terminalPods: string[] = [];

    visited.add(sourcePodId);

    while (queue.length > 0) {
      const currentPodId = queue.shift()!;
      const hasOutgoingAutoTrigger = this.hasOutgoingAutoTrigger(currentPodId);

      // Only add non-source PODs without outgoing auto-trigger as terminal PODs
      if (currentPodId !== sourcePodId && !hasOutgoingAutoTrigger) {
        terminalPods.push(currentPodId);
      }

      // If has outgoing auto-trigger, continue BFS traversal
      if (hasOutgoingAutoTrigger) {
        const outgoingConnections = connectionStore
          .findBySourcePodId(currentPodId)
          .filter((conn) => conn.autoTrigger);

        for (const connection of outgoingConnections) {
          const targetPodId = connection.targetPodId;
          if (!visited.has(targetPodId)) {
            visited.add(targetPodId);
            queue.push(targetPodId);
          }
        }
      }
    }

    console.log(
      `[AutoClear] Found ${terminalPods.length} terminal PODs for source ${sourcePodId}: ${terminalPods.join(', ')}`
    );

    return terminalPods;
  }

  /**
   * Check if a POD has any outgoing auto-trigger connections
   */
  hasOutgoingAutoTrigger(podId: string): boolean {
    const outgoingConnections = connectionStore.findBySourcePodId(podId);
    return outgoingConnections.some((conn) => conn.autoTrigger);
  }

  /**
   * Handle POD completion and check if auto-clear should be triggered
   */
  async onPodComplete(podId: string): Promise<void> {
    const pod = podStore.getById(podId);
    if (!pod) {
      return;
    }

    // Check if this POD is being tracked as a terminal POD
    const { allComplete, sourcePodId } = terminalPodTracker.recordCompletion(podId);

    if (allComplete && sourcePodId) {
      console.log(
        `[AutoClear] All terminal PODs complete for source ${sourcePodId}, executing auto-clear`
      );
      await this.executeAutoClear(sourcePodId);
      terminalPodTracker.clearTracking(sourcePodId);
      return;
    }

    // If not in workflow tracking, check if this is a standalone POD with autoClear enabled
    if (!pod.autoClear) {
      return;
    }

    // Check if this POD has outgoing auto-trigger connections (part of a workflow)
    if (this.hasOutgoingAutoTrigger(podId)) {
      console.log(
        `[AutoClear] POD ${podId} has auto-trigger connections, skipping standalone auto-clear`
      );
      return;
    }

    // This is a standalone POD with autoClear enabled
    console.log(`[AutoClear] Executing auto-clear for standalone POD ${podId}`);
    await this.executeAutoClear(podId);
  }

  /**
   * Initialize workflow tracking for a source POD
   * Called when a POD with autoClear starts a workflow
   */
  initializeWorkflowTracking(sourcePodId: string): void {
    const pod = podStore.getById(sourcePodId);
    if (!pod || !pod.autoClear) {
      return;
    }

    // Check if source POD has outgoing auto-trigger connections
    if (!this.hasOutgoingAutoTrigger(sourcePodId)) {
      console.log(
        `[AutoClear] Source POD ${sourcePodId} has no auto-trigger connections, skipping workflow tracking`
      );
      return;
    }

    // Find all terminal PODs in the workflow
    const terminalPodIds = this.findTerminalPods(sourcePodId);

    if (terminalPodIds.length === 0) {
      console.log(
        `[AutoClear] No terminal PODs found for source ${sourcePodId}, skipping workflow tracking`
      );
      return;
    }

    // Initialize tracking
    terminalPodTracker.initializeTracking(sourcePodId, terminalPodIds);
  }

  /**
   * Execute auto-clear for a workflow starting from sourcePodId
   */
  async executeAutoClear(sourcePodId: string): Promise<void> {
    try {
      console.log(`[AutoClear] Executing auto-clear for source POD ${sourcePodId}`);

      const result = await workflowClearService.clearWorkflow(sourcePodId);

      if (result.success) {
        const payload = {
          sourcePodId,
          clearedPodIds: result.clearedPodIds,
          clearedPodNames: result.clearedPodNames,
        };

        // Emit to all affected PODs
        for (const podId of result.clearedPodIds) {
          socketService.emitToPod(podId, WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED, payload);
        }

        console.log(
          `[AutoClear] Successfully cleared ${result.clearedPodIds.length} PODs: ${result.clearedPodNames.join(', ')}`
        );
      } else {
        console.error(`[AutoClear] Failed to execute auto-clear: ${result.error}`);
      }
    } catch (error) {
      console.error(`[AutoClear] Error during auto-clear execution:`, error);
    }
  }
}

export const autoClearService = new AutoClearService();
