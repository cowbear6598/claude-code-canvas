import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents} from '../../schemas/index.js';
import type { TriggerMode } from '../../types/index.js';
import type {
  PipelineContext,
  PipelineMethods,
  AiDecideMethods,
  AutoTriggerMethods,
  TriggerStrategy,
} from './types.js';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {socketService} from '../socketService.js';
import {summaryService} from '../summaryService.js';
import {workflowQueueService} from './workflowQueueService.js';
import {autoClearService} from '../autoClear/index.js';
import {logger} from '../../utils/logger.js';
import {fireAndForget} from '../../utils/operationHelpers.js';
import {commandService} from '../commandService.js';
import {executeStreamingChat} from '../claude/streamingChatExecutor.js';
import {
    buildTransferMessage,
    buildMessageWithCommand,
    forEachMultiInputGroupConnection,
    forEachDirectConnection,
} from './workflowHelpers.js';
import {workflowAutoTriggerService} from './workflowAutoTriggerService.js';
import { LazyInitializable } from './lazyInitializable.js';

interface ExecutionServiceDeps {
  pipeline: PipelineMethods;
  aiDecideTriggerService: AiDecideMethods;
  autoTriggerService: AutoTriggerMethods;
  directTriggerService: TriggerStrategy;
}

class WorkflowExecutionService extends LazyInitializable<ExecutionServiceDeps> {
  private getLastAssistantFallback(sourcePodId: string): { content: string; isSummarized: boolean } | null {
    const fallback = workflowAutoTriggerService.getLastAssistantMessage(sourcePodId);
    return fallback ? { content: fallback, isSummarized: false } : null;
  }

  async generateSummaryWithFallback(
    canvasId: string,
    sourcePodId: string,
    targetPodId: string
  ): Promise<{ content: string; isSummarized: boolean } | null> {
    podStore.setStatus(canvasId, sourcePodId, 'summarizing');
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    const targetPod = podStore.getById(canvasId, targetPodId);
    logger.log('Workflow', 'Create', `Generating customized summary for source POD "${sourcePod?.name ?? sourcePodId}" to target POD "${targetPod?.name ?? targetPodId}"`);

    let summaryResult: Awaited<ReturnType<typeof summaryService.generateSummaryForTarget>>;
    try {
      summaryResult = await summaryService.generateSummaryForTarget(
        canvasId,
        sourcePodId,
        targetPodId
      );
    } catch (error) {
      logger.error('Workflow', 'Error', 'Failed to generate summary', error);
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return this.getLastAssistantFallback(sourcePodId);
    }

    if (summaryResult.success) {
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return { content: summaryResult.summary, isSummarized: true };
    }

    logger.error('Workflow', 'Error', `Failed to generate summary: ${summaryResult.error}`);
    podStore.setStatus(canvasId, sourcePodId, 'idle');
    return this.getLastAssistantFallback(sourcePodId);
  }

  async checkAndTriggerWorkflows(canvasId: string, sourcePodId: string): Promise<void> {
    this.ensureInitialized();

    const connections = connectionStore.findBySourcePodId(canvasId, sourcePodId);

    if (connections.length === 0) {
      return;
    }

    const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
    const aiDecideConnections = connections.filter((conn) => conn.triggerMode === 'ai-decide');
    const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

    autoClearService.initializeWorkflowTracking(canvasId, sourcePodId);

    await Promise.allSettled([
      ...autoConnections.map(connection =>
        this.deps.autoTriggerService.processAutoTriggerConnection(canvasId, sourcePodId, connection)
      ),
      aiDecideConnections.length > 0
        ? this.deps.aiDecideTriggerService.processAiDecideConnections(canvasId, sourcePodId, aiDecideConnections)
        : Promise.resolve(),
      ...directConnections.map(connection => {
        const pipelineContext: PipelineContext = {
          canvasId,
          sourcePodId,
          connection,
          triggerMode: 'direct',
          decideResult: { connectionId: connection.id, approved: true, reason: null, isError: false },
        };
        return this.deps.pipeline.execute(pipelineContext, this.deps.directTriggerService);
      }),
    ]);
  }

  /**
   * 此方法為唯一負責設定 connection active 狀態的入口點。
   * 所有觸發模式（auto、ai-decide、direct）皆透過此方法統一設定 active，
   * 確保 summary 產生後才顯示 active，避免過早顯示。
   */
  async triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    strategy: TriggerStrategy
  ): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      logger.warn('Workflow', 'Warn', `triggerWorkflowWithSummary: Connection ${connectionId} 已不存在，跳過觸發`);
      return;
    }

    const { sourcePodId, targetPodId } = connection;

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    logger.log('Workflow', 'Create', `觸發工作流程：Pod "${sourcePod?.name ?? sourcePodId}" → Pod "${targetPod.name}"`);

    const triggerMode = connection.triggerMode;
    this.setConnectionsToActive(canvasId, targetPodId, triggerMode);

    strategy.onTrigger({
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      summary,
      isSummarized,
    });

    podStore.setStatus(canvasId, targetPodId, 'chatting');
    // 刻意不 await：Claude 查詢是長時間操作，結果透過 WebSocket 事件通知前端。
    // 若改為 await，呼叫方的 Promise.allSettled 會等到查詢完成才繼續，喪失多 connection 並行觸發的能力。
    fireAndForget(
      this.executeClaudeQuery({ canvasId, connectionId, sourcePodId, targetPodId, content: summary, strategy }),
      'Workflow',
      `executeClaudeQuery 執行失敗 (connection: ${connectionId})`
    );
  }

  private setConnectionsToActive(canvasId: string, targetPodId: string, triggerMode: TriggerMode): void {
    const forEachFn = (triggerMode === 'auto' || triggerMode === 'ai-decide')
      ? forEachMultiInputGroupConnection
      : forEachDirectConnection;

    forEachFn(canvasId, targetPodId, (conn) => {
      const stillExists = connectionStore.getById(canvasId, conn.id);
      if (!stillExists) {
        logger.warn('Workflow', 'Warn', `Connection ${conn.id} 已不存在，跳過 active 狀態設定`);
        return;
      }
      connectionStore.updateConnectionStatus(canvasId, conn.id, 'active');
    });
  }

  private scheduleNextInQueue(canvasId: string, targetPodId: string): void {
    // 刻意不 await：佇列處理獨立於當前 workflow，避免阻塞完成/錯誤回調
    fireAndForget(
      workflowQueueService.processNextInQueue(canvasId, targetPodId),
      'Workflow',
      '處理佇列下一項時發生錯誤'
    );
  }

  private async executeClaudeQuery(params: {
    canvasId: string;
    connectionId: string;
    sourcePodId: string;
    targetPodId: string;
    content: string;
    strategy: TriggerStrategy;
  }): Promise<void> {
    const { canvasId, connectionId, sourcePodId, targetPodId, content, strategy } = params;
    const baseMessage = buildTransferMessage(content);
    const targetPod = podStore.getById(canvasId, targetPodId);
    const commands = await commandService.list();
    const messageToSend = buildMessageWithCommand(baseMessage, targetPod, commands);

    const userMessageId = uuidv4();

    socketService.emitToCanvas(
      canvasId,
      WebSocketResponseEvents.POD_CHAT_USER_MESSAGE,
      {
        canvasId,
        podId: targetPodId,
        messageId: userMessageId,
        content: messageToSend,
        timestamp: new Date().toISOString(),
      }
    );

    await messageStore.addMessage(canvasId, targetPodId, 'user', messageToSend);

    await executeStreamingChat(
      { canvasId, podId: targetPodId, message: messageToSend, supportAbort: false },
      {
        onComplete: async () => {
          strategy.onComplete(
            { canvasId, connectionId, sourcePodId, targetPodId, triggerMode: strategy.mode },
            true
          );
          logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);
          await autoClearService.onPodComplete(canvasId, targetPodId);
          // 刻意不 await：下游 workflow 觸發獨立於當前查詢完成流程
          fireAndForget(
            this.checkAndTriggerWorkflows(canvasId, targetPodId),
            'Workflow',
            `下游 workflow 觸發失敗 (pod: ${targetPodId})`
          );
          this.scheduleNextInQueue(canvasId, targetPodId);
        },
        onError: async (_ignoredCanvasId, _ignoredPodId, error) => {
          const errorMessage = error.message;
          strategy.onError(
            { canvasId, connectionId, sourcePodId, targetPodId, triggerMode: strategy.mode },
            errorMessage
          );
          logger.error('Workflow', 'Error', 'Failed to complete workflow', error);
          podStore.setStatus(canvasId, targetPodId, 'idle');
          this.scheduleNextInQueue(canvasId, targetPodId);
        },
      }
    );
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
