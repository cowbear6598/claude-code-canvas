interface DirectPending {
  targetPodId: string;
  readySummaries: Map<string, string>;
  timer: ReturnType<typeof setTimeout> | null;
  createdAt: Date;
}

class DirectTriggerStore {
  private pendingTargets: Map<string, DirectPending> = new Map();

  initializeDirectPending(targetPodId: string): void {
    if (!this.pendingTargets.has(targetPodId)) {
      this.pendingTargets.set(targetPodId, {
        targetPodId,
        readySummaries: new Map(),
        timer: null,
        createdAt: new Date(),
      });
    }
  }

  recordDirectReady(targetPodId: string, sourcePodId: string, summaryContent: string): number {
    const pending = this.pendingTargets.get(targetPodId);
    if (!pending) {
      return 0;
    }

    pending.readySummaries.set(sourcePodId, summaryContent);
    return pending.readySummaries.size;
  }

  getReadySummaries(targetPodId: string): Map<string, string> | null {
    const pending = this.pendingTargets.get(targetPodId);
    return pending ? pending.readySummaries : null;
  }

  getReadyCount(targetPodId: string): number {
    const pending = this.pendingTargets.get(targetPodId);
    return pending ? pending.readySummaries.size : 0;
  }

  setTimer(targetPodId: string, timer: ReturnType<typeof setTimeout>): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (pending) {
      pending.timer = timer;
    }
  }

  getTimer(targetPodId: string): ReturnType<typeof setTimeout> | null {
    const pending = this.pendingTargets.get(targetPodId);
    return pending?.timer || null;
  }

  clearTimer(targetPodId: string): void {
    const pending = this.pendingTargets.get(targetPodId);
    if (pending && pending.timer) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
  }

  hasActiveTimer(targetPodId: string): boolean {
    const pending = this.pendingTargets.get(targetPodId);
    return !!(pending && pending.timer);
  }

  hasDirectPending(targetPodId: string): boolean {
    return this.pendingTargets.has(targetPodId);
  }

  clearDirectPending(targetPodId: string): void {
    this.clearTimer(targetPodId);
    this.pendingTargets.delete(targetPodId);
  }
}

export const directTriggerStore = new DirectTriggerStore();
