import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';

// Import 真實模組
import { workflowQueueService } from '../../src/services/workflow';
import { podStore } from '../../src/services/podStore.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { workflowEventEmitter } from '../../src/services/workflow';
import { socketService } from '../../src/services/socketService.js';
import { logger } from '../../src/utils/logger.js';

describe('WorkflowQueueService', () => {
  const canvasId = 'canvas-1';
  const targetPodId = 'target-pod-1';
  const sourcePodId = 'source-pod-1';
  const connectionId = 'conn-1';

  // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
  let spies: Array<ReturnType<typeof spyOn>> = [];

  /**
   * 輔助函數：安全地 spy 或重置已存在的 mock
   * 如果方法已經是 mock（由其他測試的 mock.module 建立），則重置它
   * 否則建立新的 spy
   */
  const setupMock = <T extends object, K extends keyof T>(
    obj: T,
    method: K,
    mockConfig: { returnValue?: any; implementation?: any; resolvedValue?: any }
  ) => {
    const target = obj[method];

    // 如果目標不存在或是 undefined，說明被其他測試的 mock.module 污染但沒有正確初始化
    // 我們需要創建一個新的 mock 函數
    if (target === undefined || target === null) {
      const newMock = mock();
      (obj as any)[method] = newMock;

      if ('returnValue' in mockConfig) {
        newMock.mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        newMock.mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        newMock.mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為這是替換已污染的模組
    }

    // 檢查是否已經是 mock 函數（由其他測試的 mock.module 建立）
    if (typeof target === 'function' && 'mockReturnValue' in target) {
      // 已經是 mock，清空並重新設定
      (target as any).mockClear?.();
      if ('returnValue' in mockConfig) {
        (target as any).mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        (target as any).mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        (target as any).mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為不是我們創建的
    }

    // 真實函數，使用 spyOn
    const spy = spyOn(obj, method as any);
    if ('returnValue' in mockConfig) {
      spy.mockReturnValue(mockConfig.returnValue);
    } else if ('implementation' in mockConfig) {
      spy.mockImplementation(mockConfig.implementation);
    } else if ('resolvedValue' in mockConfig) {
      spy.mockResolvedValue(mockConfig.resolvedValue);
    }
    spies.push(spy);
  };

  beforeEach(() => {
    // 清空 spy 陣列
    spies = [];

    // 清空佇列
    workflowQueueService.clearQueue(targetPodId);
    workflowQueueService.clearQueue('target-pod-2');

    // podStore
    setupMock(podStore, 'getById', { returnValue: { id: targetPodId, status: 'idle' } });
    setupMock(podStore, 'setStatus', { implementation: () => {} });

    // connectionStore
    setupMock(connectionStore, 'updateConnectionStatus', { implementation: () => {} });

    // workflowEventEmitter
    setupMock(workflowEventEmitter, 'emitWorkflowQueued', { implementation: () => {} });
    setupMock(workflowEventEmitter, 'emitWorkflowQueueProcessed', { implementation: () => {} });

    // socketService
    setupMock(socketService, 'emitToCanvas', { implementation: () => {} });

    // logger
    setupMock(logger, 'log', { implementation: () => {} });
    setupMock(logger, 'error', { implementation: () => {} });
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies = [];
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
