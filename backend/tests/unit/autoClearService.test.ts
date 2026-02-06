import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { autoClearService } from '../../src/services/autoClear';
import { connectionStore } from '../../src/services/connectionStore.js';
import { podStore } from '../../src/services/podStore.js';
import { terminalPodTracker } from '../../src/services/autoClear';
import type { Pod, Connection } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

describe('AutoClearService 單元測試', () => {
  const canvasId = 'test-canvas-id';

  beforeEach(() => {
    // 清空 stores
    // bun:test 會自動清理 mock
  });

  describe('findTerminalPods - BFS 邏輯測試', () => {
    it('測試單一鏈式連接：A -> B -> C', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      // Mock connectionStore
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, 'auto')];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podC.id, 'auto')];
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
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, 'auto'),
            createMockConnection(podA.id, podC.id, 'auto'),
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
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, 'auto')];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podC.id, 'auto')];
        }
        if (sourceId === podC.id) {
          return [createMockConnection(podC.id, podA.id, 'auto')];
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
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, 'auto'),
            createMockConnection(podA.id, podC.id, 'ai-decide'), // 不是 auto-trigger
          ];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podD.id, 'auto')];
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

      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, 'auto'),
            createMockConnection(podA.id, podC.id, 'auto'),
          ];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podD.id, 'auto')];
        }
        if (sourceId === podC.id) {
          return [createMockConnection(podC.id, podE.id, 'auto')];
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

      spyOn(podStore, 'getById').mockReturnValue(undefined);
      spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, podId);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當 Pod 沒有 autoClear 時，不執行初始化', () => {
      const pod = createMockPod('A', false);

      spyOn(podStore, 'getById').mockReturnValue(pod);
      spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, pod.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當 Pod 沒有 outgoing auto-trigger 時，不執行初始化', () => {
      const pod = createMockPod('A', true);

      spyOn(podStore, 'getById').mockReturnValue(pod);
      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, pod.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('當沒有 terminal pods 時，不執行初始化', () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);

      // A -> B -> A (循環)
      spyOn(podStore, 'getById').mockReturnValue(podA);
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [createMockConnection(podA.id, podB.id, 'auto')];
        }
        if (sourceId === podB.id) {
          return [createMockConnection(podB.id, podA.id, 'auto')];
        }
        return [];
      });
      spyOn(terminalPodTracker, 'initializeTracking');

      autoClearService.initializeWorkflowTracking(canvasId, podA.id);

      expect(terminalPodTracker.initializeTracking).not.toHaveBeenCalled();
    });

    it('正常情況下，正確初始化 terminalPodTracker', () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);
      const podC = createMockPod('C', true);

      // A -> B, A -> C
      spyOn(podStore, 'getById').mockReturnValue(podA);
      spyOn(connectionStore, 'findBySourcePodId').mockImplementation((cId, sourceId) => {
        if (sourceId === podA.id) {
          return [
            createMockConnection(podA.id, podB.id, 'auto'),
            createMockConnection(podA.id, podC.id, 'auto'),
          ];
        }
        return [];
      });
      spyOn(terminalPodTracker, 'initializeTracking');

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

      spyOn(podStore, 'getById').mockReturnValue(undefined);
      spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, podId);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 沒有 autoClear 時，不執行清除', async () => {
      const pod = createMockPod('A', false);

      spyOn(podStore, 'getById').mockReturnValue(pod);
      spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, pod.id);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 有 outgoing auto-trigger 時，等待下游完成（不立即清除）', async () => {
      const podA = createMockPod('A', true);
      const podB = createMockPod('B', true);

      spyOn(podStore, 'getById').mockReturnValue(podA);
      spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([
        createMockConnection(podA.id, podB.id, 'auto'),
      ]);
      spyOn(autoClearService, 'executeAutoClear');

      await autoClearService.onPodComplete(canvasId, podA.id);

      expect(autoClearService.executeAutoClear).not.toHaveBeenCalled();
    });

    it('Pod 是獨立的 terminal 時，立即清除', async () => {
      const pod = createMockPod('A', true);

      spyOn(podStore, 'getById').mockReturnValue(pod);
      spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: false,
        sourcePodId: null,
      });
      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);
      spyOn(autoClearService, 'executeAutoClear').mockResolvedValue();

      await autoClearService.onPodComplete(canvasId, pod.id);

      expect(autoClearService.executeAutoClear).toHaveBeenCalledWith(canvasId, pod.id);
    });

    it('當所有 terminal pods 完成時，執行 auto-clear', async () => {
      const podA = createMockPod('A', true);
      const sourcePodId = uuidv4();

      spyOn(podStore, 'getById').mockReturnValue(podA);
      spyOn(terminalPodTracker, 'recordCompletion').mockReturnValue({
        allComplete: true,
        sourcePodId: sourcePodId,
      });
      spyOn(terminalPodTracker, 'clearTracking');
      spyOn(autoClearService, 'executeAutoClear').mockResolvedValue();

      await autoClearService.onPodComplete(canvasId, podA.id);

      expect(autoClearService.executeAutoClear).toHaveBeenCalledWith(canvasId, sourcePodId);
      expect(terminalPodTracker.clearTracking).toHaveBeenCalledWith(sourcePodId);
    });
  });

  describe('hasOutgoingAutoTrigger - 輔助方法測試', () => {
    it('當沒有 outgoing connections 時，返回 false', () => {
      const podId = uuidv4();

      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);

      const result = autoClearService.hasOutgoingAutoTrigger(canvasId, podId);

      expect(result).toBe(false);
    });

    it('當沒有 triggerable connections 時，返回 false', () => {
      const podA = createMockPod('A');

      // Mock 沒有任何 outgoing connections
      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([]);

      const result = autoClearService.hasOutgoingAutoTrigger(canvasId, podA.id);

      expect(result).toBe(false);
    });

    it('當有至少一個 auto-trigger connection 時，返回 true', () => {
      const podA = createMockPod('A');
      const podB = createMockPod('B');
      const podC = createMockPod('C');

      spyOn(connectionStore, 'findBySourcePodId').mockReturnValue([
        createMockConnection(podA.id, podB.id),
        createMockConnection(podA.id, podC.id, 'auto'),
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
    color: 'blue',
    x: 0,
    y: 0,
    rotation: 0,
    output: [],
    status: 'idle',
    workspacePath: '/tmp/test',
    gitUrl: null,
    claudeSessionId: null,
    outputStyleId: null,
    skillIds: [],
    subAgentIds: [],
    model: 'sonnet',
    repositoryId: null,
    commandId: null,
    needsForkSession: false,
    autoClear,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };
}

function createMockConnection(
  sourcePodId: string,
  targetPodId: string,
  triggerMode: 'auto' | 'ai-decide' = 'auto'
): Connection {
  return {
    id: uuidv4(),
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    triggerMode,
    decideStatus: 'none',
    decideReason: null,
    createdAt: new Date(),
  };
}
