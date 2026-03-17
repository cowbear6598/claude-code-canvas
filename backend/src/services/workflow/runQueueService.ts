import { v4 as uuidv4 } from 'uuid';
import type { TriggerMode } from '../../types/index.js';
import type { TriggerStrategy, ExecutionServiceMethods } from './types.js';
import type { RunContext } from '../../types/run.js';
import { runStore } from '../runStore.js';
import { LazyInitializable } from './lazyInitializable.js';
import { buildRunQueueKey } from './workflowHelpers.js';
import { logger } from '../../utils/logger.js';

export interface RunQueueItem {
  id: string;
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  summary: string;
  isSummarized: boolean;
  triggerMode: TriggerMode;
  participatingConnectionIds?: string[];
  runContext: RunContext;
  enqueuedAt: Date;
}

interface RunQueueServiceDeps {
  executionService: ExecutionServiceMethods;
  strategies: { auto: TriggerStrategy; direct: TriggerStrategy; 'ai-decide': TriggerStrategy };
}

class RunQueueService extends LazyInitializable<RunQueueServiceDeps> {
  private queues: Map<string, RunQueueItem[]> = new Map();

  private getStrategy(triggerMode: TriggerMode): TriggerStrategy {
    return this.deps.strategies[triggerMode];
  }

  enqueue(item: Omit<RunQueueItem, 'id' | 'enqueuedAt'>): void {
    const queueItem: RunQueueItem = {
      ...item,
      id: uuidv4(),
      enqueuedAt: new Date(),
    };

    const key = buildRunQueueKey(item.runContext.runId, item.targetPodId);
    const queue = this.queues.get(key) ?? [];
    queue.push(queueItem);
    this.queues.set(key, queue);

    // 更新 instance 狀態為 queued
    import('./runExecutionService.js').then(({ runExecutionService }) => {
      runExecutionService.queuedPodInstance(item.runContext, item.targetPodId);
    }).catch((error) => {
      logger.error('Run', 'Error', '[RunQueueService] 載入 runExecutionService 失敗', error);
    });
  }

  dequeue(key: string): RunQueueItem | undefined {
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      return undefined;
    }

    const item = queue.shift();
    if (queue.length === 0) {
      this.queues.delete(key);
    }

    return item;
  }

  getQueueSize(key: string): number {
    const queue = this.queues.get(key);
    return queue ? queue.length : 0;
  }

  async processNext(canvasId: string, targetPodId: string, runContext: RunContext): Promise<void> {
    const key = buildRunQueueKey(runContext.runId, targetPodId);

    const instance = runStore.getPodInstance(runContext.runId, targetPodId);
    if (instance?.status === 'running') {
      return;
    }

    const item = this.dequeue(key);
    if (!item) {
      return;
    }

    const strategy = this.getStrategy(item.triggerMode);

    await this.deps.executionService.triggerWorkflowWithSummary({
      canvasId,
      connectionId: item.connectionId,
      summary: item.summary,
      isSummarized: item.isSummarized,
      participatingConnectionIds: item.participatingConnectionIds,
      strategy,
      runContext,
    });
  }
}

export const runQueueService = new RunQueueService();
