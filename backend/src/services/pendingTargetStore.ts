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

  initializePendingTarget(targetPodId: string, requiredSourcePodIds: string[]): void {
    this.pendingTargets.set(targetPodId, {
      targetPodId,
      requiredSourcePodIds,
      completedSources: new Map(),
      createdAt: new Date(),
      isReadyToTrigger: false,
    });
  }

  recordSourceCompletion(targetPodId: string, sourcePodId: string, summaryContent: string): boolean {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return false;
    }

    pending.completedSources.set(sourcePodId, summaryContent);

    return pending.completedSources.size >= pending.requiredSourcePodIds.length;
  }

  getCompletedSummaries(targetPodId: string): Map<string, string> | undefined {
    const pending = this.pendingTargets.get(targetPodId);
    return pending?.completedSources;
  }

  clearPendingTarget(targetPodId: string): void {
    this.pendingTargets.delete(targetPodId);
  }

  hasPendingTarget(targetPodId: string): boolean {
    return this.pendingTargets.has(targetPodId);
  }

  getPendingTarget(targetPodId: string): PendingTarget | undefined {
    return this.pendingTargets.get(targetPodId);
  }

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

  removeSourceFromPending(targetPodId: string, sourcePodId: string): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return;
    }

    pending.requiredSourcePodIds = pending.requiredSourcePodIds.filter(id => id !== sourcePodId);
    pending.completedSources.delete(sourcePodId);
  }

  setMergedContent(targetPodId: string, content: string): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return;
    }

    pending.mergedContent = content;
    pending.isReadyToTrigger = true;
  }

  getPendingMergedContent(targetPodId: string): string | undefined {
    const pending = this.pendingTargets.get(targetPodId);
    return pending?.mergedContent;
  }

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
