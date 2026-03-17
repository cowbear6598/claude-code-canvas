import type {
  PipelineContext,
  TriggerStrategy,
  ExecutionServiceMethods,
  MultiInputServiceMethods,
  QueueServiceMethods,
} from './types.js';
import { podStore } from '../podStore.js';
import { runStore, TRIGGERABLE_STATUSES } from '../runStore.js';
import { logger } from '../../utils/logger.js';
import { LazyInitializable } from './lazyInitializable.js';
import { fireAndForget } from '../../utils/operationHelpers.js';
import { resolveSettlementPathway, getMultiInputGroupConnections } from './workflowHelpers.js';

interface PipelineDeps {
  executionService: ExecutionServiceMethods;
  multiInputService: MultiInputServiceMethods;
  queueService: QueueServiceMethods;
}

class WorkflowPipeline extends LazyInitializable<PipelineDeps> {

  async execute(context: PipelineContext, strategy: TriggerStrategy): Promise<void> {
    const { canvasId, sourcePodId, connection, triggerMode, runContext } = context;
    const { targetPodId, id: connectionId } = connection;

    const targetPod = podStore.getById(canvasId, targetPodId);

    if (!targetPod) {
      logger.error('Workflow', 'Pipeline', `[checkQueue] 找不到目標 Pod: ${targetPodId}`);
      return;
    }

    if (runContext) {
      const targetInstance = runStore.getPodInstance(runContext.runId, targetPodId);
      if (targetInstance && !TRIGGERABLE_STATUSES.has(targetInstance.status)) {
        logger.log('Workflow', 'Pipeline', `目標 Pod「${targetPod.name}」已為 ${targetInstance.status} 狀態，跳過觸發`);
        return;
      }
    }

    const sourcePodName = podStore.getById(canvasId, sourcePodId)?.name ?? sourcePodId;

    logger.log('Workflow', 'Pipeline', `開始執行 Pipeline："${sourcePodName}" → "${targetPod.name}" (${triggerMode})`);

    const pathway = resolveSettlementPathway(triggerMode);
    const delegate = context.delegate;
    const summaryResult = await this.deps.executionService.generateSummaryWithFallback(
      canvasId,
      sourcePodId,
      targetPodId,
      runContext,
      pathway,
      delegate
    );

    if (!summaryResult) {
      logger.error('Workflow', 'Pipeline', `[generateSummary] 無法生成摘要或取得備用內容`);
      return;
    }

    const collectResult = await this.runCollectSourcesStage(context, strategy, summaryResult.content, summaryResult.isSummarized);
    if (!collectResult) return;

    const { finalSummary, finalIsSummarized, participatingConnectionIds } = collectResult;

    if (delegate?.shouldEnqueue() && delegate.isBusy(canvasId, targetPodId)) {
      logger.log('Workflow', 'Pipeline', `[checkQueue] 目標 Pod 忙碌中，加入佇列`);
      delegate.enqueue({
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        summary: finalSummary,
        isSummarized: finalIsSummarized,
        triggerMode,
        participatingConnectionIds,
        runContext,
      });
      // 安全網：立即嘗試消化佇列，防止 enqueue 發生在最後一次 scheduleNextInQueue 之後導致佇列卡住
      delegate.scheduleNextInQueue(canvasId, targetPodId);
      return;
    }

    if (!delegate && targetPod.status !== 'idle') {
      logger.log('Workflow', 'Pipeline', `[checkQueue] 目標 Pod 忙碌中 (${targetPod.status})，加入佇列`);
      this.deps.queueService.enqueue({
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        summary: finalSummary,
        isSummarized: finalIsSummarized,
        triggerMode,
        participatingConnectionIds,
        runContext,
      });
      // 安全網：立即嘗試消化佇列，防止 enqueue 發生在最後一次 scheduleNextInQueue 之後導致佇列卡住
      fireAndForget(
        this.deps.queueService.processNextInQueue(canvasId, targetPodId),
        'Workflow',
        `[checkQueue] enqueue 後嘗試消化佇列失敗`
      );
      return;
    }

    await this.deps.executionService.triggerWorkflowWithSummary({
      canvasId,
      connectionId,
      summary: finalSummary,
      isSummarized: finalIsSummarized,
      participatingConnectionIds,
      strategy,
      runContext,
      delegate,
    });
  }

  private async runCollectSourcesStage(
    context: PipelineContext,
    strategy: TriggerStrategy,
    summaryContent: string,
    isSummarized: boolean
  ): Promise<{ finalSummary: string; finalIsSummarized: boolean; participatingConnectionIds?: string[] } | null> {
    const { canvasId, sourcePodId, connection, triggerMode } = context;
    const { targetPodId } = connection;

    if (strategy.collectSources) {
      const collectResult = await strategy.collectSources({
        canvasId,
        sourcePodId,
        connection,
        summary: summaryContent,
        runContext: context.runContext,
      });

      if (!collectResult.ready) {
        return null;
      }

      const { participatingConnectionIds } = collectResult;

      if (collectResult.mergedContent) {
        return { finalSummary: collectResult.mergedContent, finalIsSummarized: collectResult.isSummarized ?? true, participatingConnectionIds };
      }

      return { finalSummary: summaryContent, finalIsSummarized: isSummarized, participatingConnectionIds };
    }

    const isMultiInput = getMultiInputGroupConnections(canvasId, targetPodId).length > 1;

    if (isMultiInput) {
      await this.deps.multiInputService.handleMultiInputForConnection({
        canvasId,
        sourcePodId,
        connection,
        summary: summaryContent,
        triggerMode: triggerMode as 'auto' | 'ai-decide',
        runContext: context.runContext,
      });
      return null;
    }

    return { finalSummary: summaryContent, finalIsSummarized: isSummarized };
  }
}

export const workflowPipeline = new WorkflowPipeline();
