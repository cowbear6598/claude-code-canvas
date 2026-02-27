import { logger } from '../../utils/logger.js';

interface PendingAutoClear {
  sourcePodId: string;
  expectedCounts: Map<string, number>;
  completedCounts: Map<string, number>;
  createdAt: Date;
}

class TerminalPodTracker {
  private pendingAutoClearMap = new Map<string, PendingAutoClear>();

  initializeTracking(sourcePodId: string, expectedCounts: Map<string, number>): void {
    if (expectedCounts.size === 0) {
      return;
    }

    const completedCounts = new Map<string, number>();
    for (const podId of expectedCounts.keys()) {
      completedCounts.set(podId, 0);
    }

    this.pendingAutoClearMap.set(sourcePodId, {
      sourcePodId,
      expectedCounts,
      completedCounts,
      createdAt: new Date(),
    });

  }

  recordCompletion(podId: string): { allComplete: boolean; sourcePodId: string | null } {
    const entry = this.findPendingEntryByPodId(podId);
    if (!entry) {
      return { allComplete: false, sourcePodId: null };
    }

    const { sourcePodId, pending } = entry;
    const currentCount = pending.completedCounts.get(podId) ?? 0;
    const expectedCount = pending.expectedCounts.get(podId) ?? 0;

    // 超額防護：若已達到預期完成次數，忽略此次呼叫
    if (currentCount >= expectedCount) {
      logger.warn('AutoClear', 'Warn', `重複的完成事件被忽略: ${podId}`);
      return { allComplete: true, sourcePodId };
    }

    pending.completedCounts.set(podId, currentCount + 1);

    const allComplete = this.checkAllComplete(pending);

    return { allComplete, sourcePodId: allComplete ? sourcePodId : null };
  }

  decrementExpectedCount(podId: string): { allComplete: boolean; sourcePodId: string | null } {
    const entry = this.findPendingEntryByPodId(podId);
    if (!entry) {
      return { allComplete: false, sourcePodId: null };
    }

    const { sourcePodId, pending } = entry;
    const currentExpected = pending.expectedCounts.get(podId) ?? 0;
    const newExpected = Math.max(0, currentExpected - 1);
    pending.expectedCounts.set(podId, newExpected);

    const completedCount = pending.completedCounts.get(podId) ?? 0;
    logger.log('AutoClear', 'Update', `Decremented expectedCount for ${podId}, source ${sourcePodId}: expected ${newExpected}, completed ${completedCount}`);

    const allComplete = this.checkAllComplete(pending);
    return { allComplete, sourcePodId: allComplete ? sourcePodId : null };
  }

  clearTracking(sourcePodId: string): void {
    this.pendingAutoClearMap.delete(sourcePodId);
  }

  clearAll(): void {
    this.pendingAutoClearMap.clear();
  }

  // 共用的查找邏輯：掃描 pendingAutoClearMap 找出包含指定 podId 的 entry
  private findPendingEntryByPodId(podId: string): { sourcePodId: string; pending: PendingAutoClear } | null {
    for (const [sourcePodId, pending] of this.pendingAutoClearMap) {
      if (pending.expectedCounts.has(podId)) {
        return { sourcePodId, pending };
      }
    }
    return null;
  }

  // 每個 terminal POD 的 completedCount >= expectedCount 才視為全部完成
  private checkAllComplete(pending: PendingAutoClear): boolean {
    for (const [podId, expectedCount] of pending.expectedCounts) {
      const completedCount = pending.completedCounts.get(podId) ?? 0;
      if (completedCount < expectedCount) {
        return false;
      }
    }
    return true;
  }
}

export const terminalPodTracker = new TerminalPodTracker();
