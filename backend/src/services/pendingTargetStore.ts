// Pending Target Store
// Manages Multi-Input waiting state for workflow targets

interface PendingTarget {
  targetPodId: string;
  requiredSourcePodIds: string[];
  completedSources: Map<string, string>;
  createdAt: Date;
  mergedContent?: string;
  isReadyToTrigger: boolean;
}

class PendingTargetStore {
  private pendingTargets: Map<string, PendingTarget> = new Map();

  /**
   * Initialize a pending target waiting for multiple sources
   */
  initializePendingTarget(targetPodId: string, requiredSourcePodIds: string[]): void {
    this.pendingTargets.set(targetPodId, {
      targetPodId,
      requiredSourcePodIds,
      completedSources: new Map(),
      createdAt: new Date(),
      isReadyToTrigger: false,
    });
  }

  /**
   * Record a source completion and check if all sources are complete
   */
  recordSourceCompletion(targetPodId: string, sourcePodId: string, summaryContent: string): boolean {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return false;
    }

    pending.completedSources.set(sourcePodId, summaryContent);

    return pending.completedSources.size >= pending.requiredSourcePodIds.length;
  }

  /**
   * Get all completed summaries for a target
   */
  getCompletedSummaries(targetPodId: string): Map<string, string> | undefined {
    const pending = this.pendingTargets.get(targetPodId);
    return pending?.completedSources;
  }

  /**
   * Clear a pending target after triggering
   */
  clearPendingTarget(targetPodId: string): void {
    this.pendingTargets.delete(targetPodId);
  }

  /**
   * Check if a target is waiting for sources
   */
  hasPendingTarget(targetPodId: string): boolean {
    return this.pendingTargets.has(targetPodId);
  }

  /**
   * Get a pending target
   */
  getPendingTarget(targetPodId: string): PendingTarget | undefined {
    return this.pendingTargets.get(targetPodId);
  }

  /**
   * Remove a source from all pending targets and return affected target IDs
   */
  removeSourceFromAllPending(sourcePodId: string): string[] {
    const affectedTargetIds: string[] = [];

    for (const [targetPodId, pending] of this.pendingTargets.entries()) {
      const wasInRequired = pending.requiredSourcePodIds.includes(sourcePodId);

      if (wasInRequired) {
        pending.requiredSourcePodIds = pending.requiredSourcePodIds.filter(id => id !== sourcePodId);
        pending.completedSources.delete(sourcePodId);
        affectedTargetIds.push(targetPodId);
      }
    }

    return affectedTargetIds;
  }

  /**
   * Remove a source from a specific pending target
   */
  removeSourceFromPending(targetPodId: string, sourcePodId: string): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return;
    }

    pending.requiredSourcePodIds = pending.requiredSourcePodIds.filter(id => id !== sourcePodId);
    pending.completedSources.delete(sourcePodId);
  }

  /**
   * Set merged content for a pending target when ready but target is busy
   */
  setMergedContent(targetPodId: string, content: string): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return;
    }

    pending.mergedContent = content;
    pending.isReadyToTrigger = true;
  }

  /**
   * Get pending merged content for a target
   */
  getPendingMergedContent(targetPodId: string): string | undefined {
    const pending = this.pendingTargets.get(targetPodId);
    return pending?.mergedContent;
  }

  /**
   * Get all target IDs that are ready to trigger
   */
  getReadyTargets(): string[] {
    const readyTargets: string[] = [];

    for (const [targetPodId, pending] of this.pendingTargets.entries()) {
      if (pending.isReadyToTrigger) {
        readyTargets.push(targetPodId);
      }
    }

    return readyTargets;
  }
}

export const pendingTargetStore = new PendingTargetStore();
