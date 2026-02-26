import { v4 as uuidv4 } from 'uuid';
import type { TriggerMode } from '../../types/index.js';
import type { TriggerStrategy, ExecutionServiceMethods } from './types.js';
import { podStore } from '../podStore.js';
import { logger } from '../../utils/logger.js';
import { LazyInitializable } from './lazyInitializable.js';

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

interface QueueServiceDeps {
  executionService: ExecutionServiceMethods;
  strategies: { auto: TriggerStrategy; direct: TriggerStrategy; 'ai-decide': TriggerStrategy };
}

class WorkflowQueueService extends LazyInitializable<QueueServiceDeps> {
  private queues: Map<string, QueueItem[]> = new Map();

  private getStrategy(triggerMode: TriggerMode): TriggerStrategy {
    this.ensureInitialized();
    return this.deps.strategies[triggerMode];
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

    const strategy = this.getStrategy(item.triggerMode);
    strategy.onQueued({
      canvasId: item.canvasId,
      connectionId: item.connectionId,
      sourcePodId: item.sourcePodId,
      targetPodId: item.targetPodId,
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
    this.ensureInitialized();

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
    const strategy = this.getStrategy(item.triggerMode);

    strategy.onQueueProcessed({
      canvasId,
      connectionId: item.connectionId,
      sourcePodId: item.sourcePodId,
      targetPodId,
      remainingQueueSize,
      triggerMode: item.triggerMode,
    });

    logger.log('Workflow', 'Update', `Processing queued workflow for target ${targetPodId}, ${remainingQueueSize} remaining`);

    await this.deps.executionService.triggerWorkflowWithSummary(
      canvasId,
      item.connectionId,
      item.summary,
      item.isSummarized,
      strategy
    );
  }
}

export const workflowQueueService = new WorkflowQueueService();
