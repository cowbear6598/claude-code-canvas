import type { Connection } from '../../types/index.js';
import type {
  TriggerStrategy,
  TriggerDecideContext,
  TriggerDecideResult,
  PipelineContext,
  TriggerLifecycleContext,
  CompletionContext,
  QueuedContext,
  QueueProcessedContext,
} from './types.js';
import { aiDecideService } from './aiDecideService.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import { connectionStore } from '../connectionStore.js';
import { workflowStateService } from './workflowStateService.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
import { workflowPipeline } from './workflowPipeline.js';
import { workflowMultiInputService } from './workflowMultiInputService.js';
import { forEachMultiInputGroupConnection } from './workflowHelpers.js';
import { logger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errorHelpers.js';

// 使用 typeof 取得實例的型別
type AiDecideService = typeof aiDecideService;
type WorkflowEventEmitter = typeof workflowEventEmitter;
type ConnectionStore = typeof connectionStore;
type WorkflowStateService = typeof workflowStateService;
type PendingTargetStore = typeof pendingTargetStore;
type WorkflowPipeline = typeof workflowPipeline;
type WorkflowMultiInputService = typeof workflowMultiInputService;

/**
 * AI-Decide 觸發策略
 *
 * 職責：
 * 1. 呼叫 aiDecideService 執行批次判斷
 * 2. 處理 approved connections（呼叫 Pipeline）
 * 3. 處理 rejected connections（記錄到多輸入狀態）
 * 4. 處理 error connections（發送錯誤事件）
 */
class WorkflowAiDecideTriggerService implements TriggerStrategy {
  readonly mode = 'ai-decide' as const;

  private aiDecideService?: AiDecideService;
  private eventEmitter?: WorkflowEventEmitter;
  private connectionStore?: ConnectionStore;
  private stateService?: WorkflowStateService;
  private pendingTargetStore?: PendingTargetStore;
  private pipeline?: WorkflowPipeline;
  private multiInputService?: WorkflowMultiInputService;

  /**
   * 延遲注入依賴（避免循環依賴）
   */
  init(
    aiDecideService: AiDecideService,
    eventEmitter: WorkflowEventEmitter,
    connectionStore: ConnectionStore,
    stateService: WorkflowStateService,
    pendingTargetStore: PendingTargetStore,
    pipeline: WorkflowPipeline,
    multiInputService: WorkflowMultiInputService
  ): void {
    this.aiDecideService = aiDecideService;
    this.eventEmitter = eventEmitter;
    this.connectionStore = connectionStore;
    this.stateService = stateService;
    this.pendingTargetStore = pendingTargetStore;
    this.pipeline = pipeline;
    this.multiInputService = multiInputService;
  }

  /**
   * 觸發生命週期 - onTrigger
   * 發送 WORKFLOW_AI_DECIDE_TRIGGERED 事件，讓前端更新同群連線為 active 狀態
   */
  onTrigger(context: TriggerLifecycleContext): void {
    this.eventEmitter!.emitWorkflowAiDecideTriggered(
      context.canvasId,
      context.connectionId,
      context.sourcePodId,
      context.targetPodId
    );
  }

  /**
   * 觸發生命週期 - onComplete
   * Workflow 完成時的處理，更新同群所有 connection 狀態
   */
  onComplete(context: CompletionContext, success: boolean, error?: string): void {
    forEachMultiInputGroupConnection(context.canvasId, context.targetPodId, (conn) => {
      this.eventEmitter!.emitWorkflowComplete(
        context.canvasId, conn.id, conn.sourcePodId,
        context.targetPodId, success, error, context.triggerMode
      );
      this.connectionStore!.updateConnectionStatus(context.canvasId, conn.id, 'idle');
    });
  }

  /**
   * 觸發生命週期 - onError
   * Workflow 錯誤時的處理，更新同群所有 connection 狀態
   */
  onError(context: CompletionContext, errorMessage: string): void {
    forEachMultiInputGroupConnection(context.canvasId, context.targetPodId, (conn) => {
      this.eventEmitter!.emitWorkflowComplete(
        context.canvasId, conn.id, conn.sourcePodId,
        context.targetPodId, false, errorMessage, context.triggerMode
      );
      this.connectionStore!.updateConnectionStatus(context.canvasId, conn.id, 'idle');
    });
  }

  /**
   * 佇列生命週期 - onQueued
   * Workflow 進入佇列時的處理
   */
  onQueued(context: QueuedContext): void {
    this.connectionStore!.updateConnectionStatus(context.canvasId, context.connectionId, 'queued');
    this.eventEmitter!.emitWorkflowQueued(context.canvasId, {
      canvasId: context.canvasId,
      targetPodId: context.targetPodId,
      connectionId: context.connectionId,
      sourcePodId: context.sourcePodId,
      position: context.position,
      queueSize: context.queueSize,
      triggerMode: context.triggerMode,
    });
  }

  /**
   * 佇列生命週期 - onQueueProcessed
   * Workflow 從佇列中處理時發送事件
   */
  onQueueProcessed(context: QueueProcessedContext): void {
    this.eventEmitter!.emitWorkflowQueueProcessed(context.canvasId, {
      canvasId: context.canvasId,
      targetPodId: context.targetPodId,
      connectionId: context.connectionId,
      sourcePodId: context.sourcePodId,
      remainingQueueSize: context.remainingQueueSize,
      triggerMode: context.triggerMode,
    });
  }

  /**
   * 實作 TriggerStrategy.decide
   * 呼叫 aiDecideService 進行批次判斷
   */
  async decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]> {
    if (!this.aiDecideService) {
      throw new Error('WorkflowAiDecideTriggerService 尚未初始化，請先呼叫 init()');
    }

    const { canvasId, sourcePodId, connections } = context;

    try {
      const batchResult = await this.aiDecideService.decideConnections(
        canvasId,
        sourcePodId,
        connections
      );

      const results: TriggerDecideResult[] = [];

      // 將成功結果轉換為 TriggerDecideResult 格式
      for (const result of batchResult.results) {
        results.push({
          connectionId: result.connectionId,
          approved: result.shouldTrigger,
          reason: result.reason,
        });
      }

      // 將錯誤結果轉換為 TriggerDecideResult 格式（approved = false）
      for (const errorResult of batchResult.errors) {
        results.push({
          connectionId: errorResult.connectionId,
          approved: false,
          reason: `錯誤：${errorResult.error}`,
        });
      }

      return results;
    } catch (error) {
      logger.error('Workflow', 'Error', '[AI-Decide] aiDecideService.decideConnections 失敗', error);

      // 所有 connections 標記為錯誤
      return connections.map(conn => ({
        connectionId: conn.id,
        approved: false,
        reason: `錯誤：${getErrorMessage(error)}`,
      }));
    }
  }

  /**
   * 處理 AI Decide connections 的批次判斷和觸發
   *
   * 此方法從 workflowExecutionService.processAiDecideConnections 搬移而來
   * 主要變更：approved 的 connection 改為呼叫 pipeline.execute()
   */
  async processAiDecideConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<void> {
    if (!this.eventEmitter || !this.connectionStore || !this.stateService || !this.pendingTargetStore || !this.pipeline || !this.multiInputService) {
      throw new Error('WorkflowAiDecideTriggerService 尚未初始化，請先呼叫 init()');
    }

    // 1. 發送 PENDING 事件
    const connectionIds = connections.map(conn => conn.id);
    this.eventEmitter.emitAiDecidePending(canvasId, connectionIds, sourcePodId);

    // 2. 更新所有 connections 狀態為 pending
    for (const conn of connections) {
      this.connectionStore.updateDecideStatus(canvasId, conn.id, 'pending', null);
    }

    // 3. 呼叫 decide() 取得判斷結果
    const decideResults = await this.decide({ canvasId, sourcePodId, connections });

    // 4. 處理判斷結果
    for (const decideResult of decideResults) {
      const conn = connections.find(c => c.id === decideResult.connectionId);
      if (!conn) continue;

      // 檢查是否為錯誤結果（reason 包含「錯誤：」）
      const isError = decideResult.reason?.startsWith('錯誤：') ?? false;

      if (isError) {
        // 處理錯誤結果
        const errorMessage = decideResult.reason ?? '未知錯誤';
        this.connectionStore.updateDecideStatus(canvasId, conn.id, 'error', errorMessage);
        this.eventEmitter.emitAiDecideError(
          canvasId,
          conn.id,
          sourcePodId,
          conn.targetPodId,
          errorMessage
        );
        logger.error('Workflow', 'Error', `AI Decide error for connection ${conn.id}: ${errorMessage}`);
        continue;
      }

      if (decideResult.approved) {
        // Approved - 透過 Pipeline 觸發
        this.connectionStore.updateDecideStatus(canvasId, conn.id, 'approved', decideResult.reason);
        this.eventEmitter.emitAiDecideResult(
          canvasId,
          conn.id,
          sourcePodId,
          conn.targetPodId,
          true,
          decideResult.reason ?? ''
        );
        logger.log('Workflow', 'Create', `AI Decide approved connection ${conn.id}: ${decideResult.reason}`);

        // 透過統一 Pipeline 處理（包含多輸入、佇列、觸發）
        const pipelineContext: PipelineContext = {
          canvasId,
          sourcePodId,
          connection: conn,
          triggerMode: 'ai-decide',
          decideResult,
        };

        this.pipeline.execute(pipelineContext, this).catch((error: unknown) => {
          logger.error('Workflow', 'Error', `Failed to execute AI-decided workflow ${conn.id}`, error);
          this.eventEmitter?.emitWorkflowComplete(
            canvasId,
            conn.id,
            sourcePodId,
            conn.targetPodId,
            false,
            getErrorMessage(error),
            'ai-decide'
          );
        });
      } else {
        // Rejected - 不觸發
        this.connectionStore.updateDecideStatus(canvasId, conn.id, 'rejected', decideResult.reason);
        this.eventEmitter.emitAiDecideResult(
          canvasId,
          conn.id,
          sourcePodId,
          conn.targetPodId,
          false,
          decideResult.reason ?? ''
        );
        logger.log('Workflow', 'Update', `AI Decide rejected connection ${conn.id}: ${decideResult.reason}`);

        // 若 target Pod 在多輸入場景中，記錄 rejection
        const { isMultiInput } = this.stateService.checkMultiInputScenario(canvasId, conn.targetPodId);
        if (isMultiInput && this.pendingTargetStore.hasPendingTarget(conn.targetPodId)) {
          this.pendingTargetStore.recordSourceRejection(conn.targetPodId, sourcePodId, decideResult.reason ?? '');
          this.stateService.emitPendingStatus(canvasId, conn.targetPodId);
        }
      }
    }
  }
}

export const workflowAiDecideTriggerService = new WorkflowAiDecideTriggerService();
