import { v4 as uuidv4 } from 'uuid';
import type { TriggerMode } from '../../types/index.js';
import { podStore } from '../podStore.js';
import { connectionStore } from '../connectionStore.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import { logger } from '../../utils/logger.js';

export interface QueueItem {
  id: string;
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  summary: string;
  isSummarized: boolean;
  triggerMode: TriggerMode;
  enqueuedAt: Date;
}

// 定義需要的 ExecutionService 方法介面（避免循環依賴）
interface ExecutionServiceMethods {
  triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    skipAutoTriggeredEvent?: boolean
  ): Promise<void>;
}

class WorkflowQueueService {
  private queues: Map<string, QueueItem[]> = new Map();
  private executionService?: ExecutionServiceMethods;

  /**
   * 初始化依賴注入
   */
  init(dependencies: { executionService: ExecutionServiceMethods }): void {
    this.executionService = dependencies.executionService;
  }

  enqueue(item: Omit<QueueItem, 'id' | 'enqueuedAt'>): { position: number; queueSize: number } {
    const queueItem: QueueItem = {
      ...item,
      id: uuidv4(),
      enqueuedAt: new Date(),
    };

    const queue = this.queues.get(item.targetPodId) || [];
    queue.push(queueItem);
    this.queues.set(item.targetPodId, queue);

    const position = queue.length;
    const queueSize = queue.length;

    connectionStore.updateConnectionStatus(item.canvasId, item.connectionId, 'queued');

    workflowEventEmitter.emitWorkflowQueued(item.canvasId, {
      canvasId: item.canvasId,
      targetPodId: item.targetPodId,
      connectionId: item.connectionId,
      sourcePodId: item.sourcePodId,
      position,
      queueSize,
      triggerMode: item.triggerMode,
    });

    logger.log('Workflow', 'Create', `Enqueued workflow for target ${item.targetPodId}, position ${position}/${queueSize}`);

    return { position, queueSize };
  }

  dequeue(targetPodId: string): QueueItem | undefined {
    const queue = this.queues.get(targetPodId);
    if (!queue || queue.length === 0) {
      return undefined;
    }

    const item = queue.shift();
    if (queue.length === 0) {
      this.queues.delete(targetPodId);
    }

    return item;
  }

  peek(targetPodId: string): QueueItem | undefined {
    const queue = this.queues.get(targetPodId);
    return queue && queue.length > 0 ? queue[0] : undefined;
  }

  getQueueSize(targetPodId: string): number {
    const queue = this.queues.get(targetPodId);
    return queue ? queue.length : 0;
  }

  hasQueuedItems(targetPodId: string): boolean {
    return this.getQueueSize(targetPodId) > 0;
  }

  clearQueue(targetPodId: string): void {
    this.queues.delete(targetPodId);
  }

  async processNextInQueue(canvasId: string, targetPodId: string): Promise<void> {
    if (!this.executionService) {
      throw new Error('WorkflowQueueService 尚未初始化，請先呼叫 init()');
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      return;
    }

    if (targetPod.status !== 'idle') {
      return;
    }

    const item = this.dequeue(targetPodId);
    if (!item) {
      return;
    }

    const remainingQueueSize = this.getQueueSize(targetPodId);

    connectionStore.updateConnectionStatus(canvasId, item.connectionId, 'active');

    workflowEventEmitter.emitWorkflowQueueProcessed(canvasId, {
      canvasId,
      targetPodId,
      connectionId: item.connectionId,
      sourcePodId: item.sourcePodId,
      remainingQueueSize,
      triggerMode: item.triggerMode,
    });

    logger.log('Workflow', 'Update', `Processing queued workflow for target ${targetPodId}, ${remainingQueueSize} remaining`);

    const skipAutoTriggeredEvent = item.triggerMode === 'direct' || item.triggerMode === 'ai-decide';
    await this.executionService.triggerWorkflowWithSummary(
      canvasId,
      item.connectionId,
      item.summary,
      item.isSummarized,
      skipAutoTriggeredEvent
    );

    connectionStore.updateConnectionStatus(canvasId, item.connectionId, 'idle');
  }
}

export const workflowQueueService = new WorkflowQueueService();
