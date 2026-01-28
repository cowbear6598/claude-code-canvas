interface PendingAutoClear {
  sourcePodId: string;
  terminalPodIds: string[];
  completedPodIds: Set<string>;
  createdAt: Date;
}

class TerminalPodTracker {
  private pendingAutoClearMap = new Map<string, PendingAutoClear>();

  initializeTracking(sourcePodId: string, terminalPodIds: string[]): void {
    if (terminalPodIds.length === 0) {
      return;
    }
    this.pendingAutoClearMap.set(sourcePodId, {
      sourcePodId,
      terminalPodIds,
      completedPodIds: new Set(),
      createdAt: new Date(),
    });

    console.log(
      `[TerminalPodTracker] Initialized tracking for source ${sourcePodId}, terminal PODs: ${terminalPodIds.join(', ')}`
    );
  }

  recordCompletion(podId: string): { allComplete: boolean; sourcePodId: string | null } {
    for (const [sourcePodId, pending] of this.pendingAutoClearMap) {
      if (pending.terminalPodIds.includes(podId)) {
        pending.completedPodIds.add(podId);
        const allComplete = pending.completedPodIds.size === pending.terminalPodIds.length;

        console.log(
          `[TerminalPodTracker] Recorded completion for ${podId}, source ${sourcePodId}: ${pending.completedPodIds.size}/${pending.terminalPodIds.length} complete`
        );

        return { allComplete, sourcePodId: allComplete ? sourcePodId : null };
      }
    }

    return { allComplete: false, sourcePodId: null };
  }

  clearTracking(sourcePodId: string): void {
    const deleted = this.pendingAutoClearMap.delete(sourcePodId);
    if (deleted) {
      console.log(`[TerminalPodTracker] Cleared tracking for source ${sourcePodId}`);
    }
  }

  hasTracking(sourcePodId: string): boolean {
    return this.pendingAutoClearMap.has(sourcePodId);
  }

  getTracking(sourcePodId: string): PendingAutoClear | undefined {
    return this.pendingAutoClearMap.get(sourcePodId);
  }

  findTrackingByTerminalPod(podId: string): string | null {
    for (const [sourcePodId, pending] of this.pendingAutoClearMap) {
      if (pending.terminalPodIds.includes(podId)) {
        return sourcePodId;
      }
    }
    return null;
  }
}

export const terminalPodTracker = new TerminalPodTracker();
