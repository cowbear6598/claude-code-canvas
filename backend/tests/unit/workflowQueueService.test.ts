import { workflowQueueService } from '../../src/services/workflow';
import { setupAllSpies } from '../mocks/workflowSpySetup.js';
import { createMockPod } from '../mocks/workflowTestFactories.js';

describe('WorkflowQueueService', () => {
  const canvasId = 'canvas-1';
  const targetPodId = 'target-pod-1';
  const sourcePodId = 'source-pod-1';
  const connectionId = 'conn-1';

  beforeEach(() => {
    const mockPod = createMockPod({ id: targetPodId, status: 'idle' });
    const podLookup = new Map([[targetPodId, mockPod]]);

    setupAllSpies({ podLookup });

    workflowQueueService.clearQueue(targetPodId);
    workflowQueueService.clearQueue('target-pod-2');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基本功能', () => {
    it('enqueue 正確加入佇列項目', () => {
      const result = workflowQueueService.enqueue({
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        summary: 'Test summary',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(result.position).toBe(1);
      expect(result.queueSize).toBe(1);
      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(1);
    });

    it('dequeue 依 FIFO 順序取出', () => {
      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId,
        summary: 'Summary 1',
        isSummarized: true,
        triggerMode: 'auto',
      });

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-2',
        sourcePodId: 'source-2',
        targetPodId,
        summary: 'Summary 2',
        isSummarized: true,
        triggerMode: 'auto',
      });

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-3',
        sourcePodId: 'source-3',
        targetPodId,
        summary: 'Summary 3',
        isSummarized: true,
        triggerMode: 'auto',
      });

      const item1 = workflowQueueService.dequeue(targetPodId);
      expect(item1?.connectionId).toBe('conn-1');

      const item2 = workflowQueueService.dequeue(targetPodId);
      expect(item2?.connectionId).toBe('conn-2');

      const item3 = workflowQueueService.dequeue(targetPodId);
      expect(item3?.connectionId).toBe('conn-3');

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);
    });

    it('佇列為空時 dequeue 回傳 undefined', () => {
      const item = workflowQueueService.dequeue(targetPodId);

      expect(item).toBeUndefined();
    });

    it('peek 查看但不移除佇列頂端項目', () => {
      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId,
        targetPodId,
        summary: 'Summary 1',
        isSummarized: true,
        triggerMode: 'auto',
      });

      const sizeBefore = workflowQueueService.getQueueSize(targetPodId);
      const item = workflowQueueService.peek(targetPodId);
      const sizeAfter = workflowQueueService.getQueueSize(targetPodId);

      expect(item?.connectionId).toBe('conn-1');
      expect(sizeBefore).toBe(sizeAfter);
      expect(sizeAfter).toBe(1);
    });

    it('getQueueSize 正確回報佇列長度', () => {
      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId,
        targetPodId,
        summary: 'Summary 1',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(1);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-2',
        sourcePodId,
        targetPodId,
        summary: 'Summary 2',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(2);
    });

    it('clearQueue 清除指定 target 的佇列', () => {
      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId,
        targetPodId,
        summary: 'Summary 1',
        isSummarized: true,
        triggerMode: 'auto',
      });

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-2',
        sourcePodId,
        targetPodId,
        summary: 'Summary 2',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(2);

      workflowQueueService.clearQueue(targetPodId);

      expect(workflowQueueService.getQueueSize(targetPodId)).toBe(0);
    });

    it('hasQueuedItems 正確偵測佇列是否有項目', () => {
      expect(workflowQueueService.hasQueuedItems(targetPodId)).toBe(false);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId,
        targetPodId,
        summary: 'Summary 1',
        isSummarized: true,
        triggerMode: 'auto',
      });

      expect(workflowQueueService.hasQueuedItems(targetPodId)).toBe(true);

      workflowQueueService.clearQueue(targetPodId);

      expect(workflowQueueService.hasQueuedItems(targetPodId)).toBe(false);
    });
  });
});
