import { describe, it, expect, beforeEach, vi } from 'vitest';
import { autoClearService } from '../../src/services/autoClear/autoClearService.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { terminalPodTracker } from '../../src/services/autoClear/terminalPodTracker.js';
import type { Pod, Connection } from '../../src/types/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('AutoClearService 單元測試', () => {
  const canvasId = 'test-canvas-id';

  beforeEach(() => {
    // 清空 stores
    vi.clearAllMocks();
  });

  describe('findTerminalPods - BFS 邏輯測試', () => {
    it('測試單一鏈式連接：A -> B -> C', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      // Mock connectionStore
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, true)];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podC.id, true)];
        }
        if (sourceId === podC.id) {
          return [];
        }
        return [];
      });

      const terminalPods = autoClearService.findTerminalPods(canvasId, podA.id);

      // podC 應該是唯一的 terminal pod（沒有 outgoing auto-trigger）
      expect(terminalPods).toHaveLength(1);
      expect(terminalPods).toContain(podC.id);
    });

    it('測試分支連接：A -> B, A -> C', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      // Mock connectionStore
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, true),
            createMockConnection(podA.id, podC.id, true),
          ];
        }
        if (sourceId === podB.id || sourceId === podC.id) {
          return [];
        }
        return [];
      });

      const terminalPods = autoClearService.findTerminalPods(canvasId, podA.id);

      // podB 和 podC 都是 terminal pods
      expect(terminalPods).toHaveLength(2);
      expect(terminalPods).toContain(podB.id);
      expect(terminalPods).toContain(podC.id);
    });

    it('測試循環防護：A -> B -> C -> A', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      // Mock connectionStore - 創建循環
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, true)];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podC.id, true)];
        }
        if (sourceId === podC.id) {
          return [createMockConnection(podC.id, podA.id, true)];
        }
        return [];
      });

      const terminalPods = autoClearService.findTerminalPods(canvasId, podA.id);

      // 沒有 terminal pod（都在循環中）
      expect(terminalPods).toHaveLength(0);
    });

    it('測試混合連接：有 auto-trigger 和無 auto-trigger 的混合', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');
      const podD = createMockPod('D');

      // A -> B (auto-trigger), A -> C (no auto-trigger), B -> D (auto-trigger)
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, true),
            createMockConnection(podA.id, podC.id, false), // 不是 auto-trigger
          ];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podD.id, true)];
        }
        if (sourceId === podC.id || sourceId === podD.id) {
          return [];
        }
        return [];
      });

      const terminalPods = autoClearService.findTerminalPods(canvasId, podA.id);

      // 只有 podD 是 terminal（podC 不透過 auto-trigger 連接，不算在內）
      expect(terminalPods).toHaveLength(1);
      expect(terminalPods).toContain(podD.id);
    });

    it('測試複雜樹狀結構：A -> B -> D, A -> C -> E', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');
      const podD = createMockPod('D');
      const podE = createMockPod('E');

      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, true),
            createMockConnection(podA.id, podC.id, true),
          ];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podD.id, true)];
        }
        if (sourceId === podC.id) {
          return [createMockConnection(podC.id, podE.id, true)];
        }
        if (sourceId === podD.id || sourceId === podE.id) {
          return [];
        }
        return [];
      });

      const terminalPods = autoClearService.findTerminalPods(canvasId, podA.id);

      // podD 和 podE 是 terminal pods
      expect(terminalPods).toHaveLength(2);
      expect(terminalPods).toContain(podD.id);
      expect(terminalPods).toContain(podE.id);
    });
  });

  describe('initializeWorkflowTracking - 初始化邏輯測試', () => {
    it('當 Pod 不存在時，不執行初始化', () => {
      const podId = uuidv4();

      vi.spyOn(podStore, 'getById').mockReturnValue(undefined);
      vi.spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, podId);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當 Pod 沒有 autoClear 時，不執行初始化', () => {
      const pod = createMockPod('A', false);

      vi.spyOn(podStore, 'getById').mockReturnValue(pod);
      vi.spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, pod.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當 Pod 沒有 outgoing auto-trigger 時，不執行初始化', () => {
      const pod = createMockPod('A', true);

      vi.spyOn(podStore, 'getById').mockReturnValue(pod);
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      vi.spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, pod.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當沒有 terminal pods 時，不執行初始化', () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);

      // A -> B -> A (循環)
      vi.spyOn(podStore, 'getById').mockReturnValue(podA);
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, true)];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podA.id, true)];
        }
        return [];
      });
      vi.spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, podA.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('正常情況下，正確初始化 terminalPodTracker', () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);
      const podC = createMockPod('C', true);

      // A -> B, A -> C
      vi.spyOn(podStore, 'getById').mockReturnValue(podA);
      vi.spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, true),
            createMockConnection(podA.id, podC.id, true),
          ];
        }
        return [];
      });
      vi.spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, podA.id);

      expect(terminalPodTracker.initializeTracking).toHaveBeenCalledWith(podA.id, [
        podB.id,
        podC.id,
      ]);
    });
  });

  describe('onPodComplete - 條件判斷測試', () => {
    it('Pod 不存在時，不執行任何操作', async () => {
      const podId = uuidv4();

      vi.spyOn(podStore, 'getById').mockReturnValue(undefined);
      vi.spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, podId);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 沒有 autoClear 時，不執行清除', async () => {
      const pod = createMockPod('A', false);

      vi.spyOn(podStore, 'getById').mockReturnValue(pod);
      vi.spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      vi.spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, pod.id);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 有 outgoing auto-trigger 時，等待下游完成（不立即清除）', async () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);

      vi.spyOn(podStore, 'getById').mockReturnValue(podA);
      vi.spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([
        createMockConnection(podA.id, podB.id, true),
      ]);
      vi.spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, podA.id);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 是獨立的 terminal 時，立即清除', async () => {
      const pod = createMockPod('A', true);

      vi.spyOn(podStore, 'getById').mockReturnValue(pod);
      vi.spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      vi.spyOn(autoClearService, 'executeAutoClear').mockResolvedValue();

      await autoClearService.onPodComplete(canvasId, pod.id);

      expect(autoClearService.executeAutoClear).toHaveBeenCalledWith(canvasId, pod.id);
    });

    it('當所有 terminal pods 完成時，執行 auto-clear', async () => {
      const podA = createMockPod('A', true);
      const sourcePodId = uuidv4();

      vi.spyOn(podStore, 'getById').mockReturnValue(podA);
      vi.spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: true,
        sourcePodId: sourcePodId,
      });
      vi.spyOn(terminalPodTracker, 'clearTracking');
      vi.spyOn(autoClearService, 'executeAutoClear').mockResolvedValue();

      await autoClearService.onPodComplete(canvasId, podA.id);

      expect(autoClearService.executeAutoClear).toHaveBeenCalledWith(canvasId, sourcePodId);
      expect(terminalPodTracker.clearTracking).toHaveBeenCalledWith(sourcePodId);
    });
  });

  describe('hasOutgoingAutoTrigger - 輔助方法測試', () => {
    it('當沒有 outgoing connections 時，返回 false', () => {
      const podId = uuidv4();

      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);

      const result = autoClearService.hasOutgoingAutoTrigger(canvasId, podId);

      expect(result).toBe(false);
    });

    it('當有 outgoing connections 但都不是 auto-trigger 時，返回 false', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');

      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([
        createMockConnection(podA.id, podB.id, false),
      ]);

      const result = autoClearService.hasOutgoingAutoTrigger(canvasId, podA.id);

      expect(result).toBe(false);
    });

    it('當有至少一個 auto-trigger connection 時，返回 true', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      vi.spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([
        createMockConnection(podA.id, podB.id, false),
        createMockConnection(podA.id, podC.id, true),
      ]);

      const result = autoClearService.hasOutgoingAutoTrigger(canvasId, podA.id);

      expect(result).toBe(true);
    });
  });
});

// Helper functions
function createMockPod(name: string, autoClear: boolean = false): Pod {
  return {
    id: uuidv4(),
    name: `Pod ${name}`,
    x: 0,
    y: 0,
    messages: [],
    status: 'idle',
    summary: '',
    autoClear,
    createdAt: new Date(),
  };
}

function createMockConnection(
  sourcePodId: string,
  targetPodId: string,
  autoTrigger: boolean
): Connection {
  return {
    id: uuidv4(),
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    autoTrigger,
    createdAt: new Date(),
  };
}
