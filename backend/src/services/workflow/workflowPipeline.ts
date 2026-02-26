import type {
  PipelineContext,
  TriggerStrategy,
  ExecutionServiceMethods,
  StateServiceMethods,
  MultiInputServiceMethods,
  QueueServiceMethods,
} from './types.js';
import { podStore } from '../podStore.js';
import { logger } from '../../utils/logger.js';
import { LazyInitializable } from './lazyInitializable.js';

interface PipelineDeps {
  executionService: ExecutionServiceMethods;
  stateService: StateServiceMethods;
  multiInputService: MultiInputServiceMethods;
  queueService: QueueServiceMethods;
}

class WorkflowPipeline extends LazyInitializable<PipelineDeps> {

  /**
   * 執行統一的觸發 Pipeline
   *
   * 流程：
   * 1. generateSummary 階段：生成摘要
   * 2. collectSources 階段：收集來源（多輸入處理）
   * 3. checkQueue 階段：檢查目標 Pod 是否忙碌
   * 4. trigger 階段：觸發工作流程
   */
  async execute(context: PipelineContext, strategy: TriggerStrategy): Promise<void> {
    this.ensureInitialized();

    const { canvasId, sourcePodId, connection, triggerMode } = context;
    const { targetPodId, id: connectionId } = connection;

    logger.log('Workflow', 'Pipeline', `開始執行 Pipeline：${sourcePodId} → ${targetPodId} (${triggerMode})`);

    logger.log('Workflow', 'Pipeline', `[generateSummary] 生成摘要：${sourcePodId} → ${targetPodId}`);
    const summaryResult = await this.deps.executionService.generateSummaryWithFallback(
      canvasId,
      sourcePodId,
      targetPodId
    );

    if (!summaryResult) {
      logger.error('Workflow', 'Pipeline', `[generateSummary] 無法生成摘要或取得備用內容`);
      return;
    }

    logger.log('Workflow', 'Pipeline', `[collectSources] 收集來源`);
    const collectResult = await this.runCollectSourcesStage(context, strategy, summaryResult.content, summaryResult.isSummarized);
    if (!collectResult) return;

    const { finalSummary, finalIsSummarized } = collectResult;

    logger.log('Workflow', 'Pipeline', `[checkQueue] 檢查目標 Pod 狀態`);
    const targetPod = podStore.getById(canvasId, targetPodId);

    if (!targetPod) {
      logger.error('Workflow', 'Pipeline', `[checkQueue] 找不到目標 Pod: ${targetPodId}`);
      return;
    }

    if (targetPod.status !== 'idle') {
      logger.log('Workflow', 'Pipeline', `[checkQueue] 目標 Pod 忙碌中 (${targetPod.status})，加入佇列`);
      this.deps.queueService.enqueue({
        canvasId,
        connectionId,
        sourcePodId,
        targetPodId,
        summary: finalSummary,
        isSummarized: finalIsSummarized,
        triggerMode,
      });
      return;
    }

    logger.log('Workflow', 'Pipeline', `[trigger] 觸發工作流程`);

    await this.deps.executionService.triggerWorkflowWithSummary(
      canvasId,
      connectionId,
      finalSummary,
      finalIsSummarized,
      strategy
    );

    logger.log('Workflow', 'Pipeline', `Pipeline 執行完成`);
  }

  private async runCollectSourcesStage(
    context: PipelineContext,
    strategy: TriggerStrategy,
    summaryContent: string,
    summaryIsSummarized: boolean
  ): Promise<{ finalSummary: string; finalIsSummarized: boolean } | null> {
    this.ensureInitialized();
    const { canvasId, sourcePodId, connection, triggerMode } = context;
    const { targetPodId } = connection;

    if (strategy.collectSources) {
      logger.log('Workflow', 'Pipeline', `[collectSources] 使用 Strategy 自訂邏輯`);
      const collectResult = await strategy.collectSources({
        canvasId,
        sourcePodId,
        connection,
        summary: summaryContent,
      });

      if (!collectResult.ready) {
        logger.log('Workflow', 'Pipeline', `[collectSources] 來源尚未就緒，暫停 Pipeline`);
        return null;
      }

      if (collectResult.mergedContent) {
        logger.log('Workflow', 'Pipeline', `[collectSources] 使用合併內容`);
        return { finalSummary: collectResult.mergedContent, finalIsSummarized: collectResult.isSummarized ?? true };
      }

      return { finalSummary: summaryContent, finalIsSummarized: summaryIsSummarized };
    }

    logger.log('Workflow', 'Pipeline', `[collectSources] 使用預設多輸入邏輯`);
    const { isMultiInput, requiredSourcePodIds } = this.deps.stateService.checkMultiInputScenario(
      canvasId,
      targetPodId
    );

    if (isMultiInput) {
      logger.log('Workflow', 'Pipeline', `[collectSources] 偵測到多輸入場景`);
      await this.deps.multiInputService.handleMultiInputForConnection(
        canvasId,
        sourcePodId,
        connection,
        requiredSourcePodIds,
        summaryContent,
        triggerMode as 'auto' | 'ai-decide'
      );
      return null;
    }

    return { finalSummary: summaryContent, finalIsSummarized: summaryIsSummarized };
  }
}

export const workflowPipeline = new WorkflowPipeline();
