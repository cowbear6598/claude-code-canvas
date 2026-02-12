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

class WorkflowPipeline {
  private executionService?: ExecutionServiceMethods;
  private stateService?: StateServiceMethods;
  private multiInputService?: MultiInputServiceMethods;
  private queueService?: QueueServiceMethods;

  /**
   * 初始化 Pipeline 依賴（延遲注入，避免循環依賴）
   */
  init(
    executionService: ExecutionServiceMethods,
    stateService: StateServiceMethods,
    multiInputService: MultiInputServiceMethods,
    queueService: QueueServiceMethods
  ): void {
    this.executionService = executionService;
    this.stateService = stateService;
    this.multiInputService = multiInputService;
    this.queueService = queueService;
  }

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
    if (!this.executionService || !this.stateService || !this.multiInputService || !this.queueService) {
      throw new Error('Pipeline 尚未初始化，請先呼叫 init()');
    }

    const { canvasId, sourcePodId, connection, triggerMode } = context;
    const { targetPodId, id: connectionId } = connection;

    logger.log('Workflow', 'Pipeline', `開始執行 Pipeline：${sourcePodId} → ${targetPodId} (${triggerMode})`);

    // ========== 1. generateSummary 階段 ==========
    logger.log('Workflow', 'Pipeline', `[generateSummary] 生成摘要：${sourcePodId} → ${targetPodId}`);
    const summaryResult = await this.executionService.generateSummaryWithFallback(
      canvasId,
      sourcePodId,
      targetPodId
    );

    if (!summaryResult) {
      logger.error('Workflow', 'Pipeline', `[generateSummary] 無法生成摘要或取得備用內容`);
      return;
    }

    let finalSummary = summaryResult.content;
    let finalIsSummarized = summaryResult.isSummarized;

    // ========== 2. collectSources 階段 ==========
    logger.log('Workflow', 'Pipeline', `[collectSources] 收集來源`);

    if (strategy.collectSources) {
      // Strategy 提供自訂 collectSources 邏輯
      logger.log('Workflow', 'Pipeline', `[collectSources] 使用 Strategy 自訂邏輯`);
      const collectResult = await strategy.collectSources({
        canvasId,
        sourcePodId,
        connection,
        summary: summaryResult.content,
      });

      if (!collectResult.ready) {
        logger.log('Workflow', 'Pipeline', `[collectSources] 來源尚未就緒，暫停 Pipeline`);
        return;
      }

      if (collectResult.mergedContent) {
        finalSummary = collectResult.mergedContent;
        finalIsSummarized = collectResult.isSummarized ?? true;
        logger.log('Workflow', 'Pipeline', `[collectSources] 使用合併內容`);
      }
    } else {
      // 使用預設邏輯：檢查多輸入
      logger.log('Workflow', 'Pipeline', `[collectSources] 使用預設多輸入邏輯`);
      const { isMultiInput, requiredSourcePodIds } = this.stateService.checkMultiInputScenario(
        canvasId,
        targetPodId
      );

      if (isMultiInput) {
        logger.log('Workflow', 'Pipeline', `[collectSources] 偵測到多輸入場景`);
        await this.multiInputService.handleMultiInputForConnection(
          canvasId,
          sourcePodId,
          connection,
          requiredSourcePodIds,
          summaryResult.content,
          triggerMode as 'auto' | 'ai-decide'
        );
        return;
      }
    }

    // ========== 3. checkQueue 階段 ==========
    logger.log('Workflow', 'Pipeline', `[checkQueue] 檢查目標 Pod 狀態`);
    const targetPod = podStore.getById(canvasId, targetPodId);

    if (!targetPod) {
      logger.error('Workflow', 'Pipeline', `[checkQueue] 找不到目標 Pod: ${targetPodId}`);
      return;
    }

    if (targetPod.status !== 'idle') {
      logger.log('Workflow', 'Pipeline', `[checkQueue] 目標 Pod 忙碌中 (${targetPod.status})，加入佇列`);
      this.queueService.enqueue({
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

    // ========== 4. trigger 階段 ==========
    logger.log('Workflow', 'Pipeline', `[trigger] 觸發工作流程`);

    await this.executionService.triggerWorkflowWithSummary(
      canvasId,
      connectionId,
      finalSummary,
      finalIsSummarized,
      strategy
    );

    logger.log('Workflow', 'Pipeline', `Pipeline 執行完成`);
  }
}

export const workflowPipeline = new WorkflowPipeline();
