import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents, SystemConnectionIds} from '../../schemas/index.js';
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
import {commandService} from '../commandService.js';
import {executeStreamingChat} from '../claude/streamingChatExecutor.js';
import {
    buildTransferMessage,
    buildMessageWithCommand,
    forEachMultiInputGroupConnection,
} from './workflowHelpers.js';
import {workflowAutoTriggerService} from './workflowAutoTriggerService.js';

class WorkflowExecutionService {
  private pipeline?: PipelineMethods;
  private aiDecideTriggerService?: AiDecideMethods;
  private autoTriggerService?: AutoTriggerMethods;
  private directTriggerService?: TriggerStrategy;

  init(deps: {
    pipeline: PipelineMethods;
    aiDecideTriggerService: AiDecideMethods;
    autoTriggerService: AutoTriggerMethods;
    directTriggerService: TriggerStrategy;
  }): void {
    this.pipeline = deps.pipeline;
    this.aiDecideTriggerService = deps.aiDecideTriggerService;
    this.autoTriggerService = deps.autoTriggerService;
    this.directTriggerService = deps.directTriggerService;
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
      const fallback = workflowAutoTriggerService.getLastAssistantMessage(sourcePodId);
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return fallback ? { content: fallback, isSummarized: false } : null;
    }

    if (summaryResult.success) {
      podStore.setStatus(canvasId, sourcePodId, 'idle');
      return { content: summaryResult.summary, isSummarized: true };
    }

    logger.error('Workflow', 'Error', `Failed to generate summary: ${summaryResult.error}`);
    const fallback = workflowAutoTriggerService.getLastAssistantMessage(sourcePodId);
    podStore.setStatus(canvasId, sourcePodId, 'idle');
    return fallback ? { content: fallback, isSummarized: false } : null;
  }

  async checkAndTriggerWorkflows(canvasId: string, sourcePodId: string): Promise<void> {
    if (!this.pipeline || !this.aiDecideTriggerService || !this.autoTriggerService || !this.directTriggerService) {
      throw new Error('WorkflowExecutionService 尚未初始化，請先呼叫 init()');
    }
    const connections = connectionStore.findBySourcePodId(canvasId, sourcePodId);
    const autoConnections = connections.filter((conn) => conn.triggerMode === 'auto');
    const aiDecideConnections = connections.filter((conn) => conn.triggerMode === 'ai-decide');
    const directConnections = connections.filter((conn) => conn.triggerMode === 'direct');

    if (autoConnections.length === 0 && aiDecideConnections.length === 0 && directConnections.length === 0) {
      return;
    }

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    logger.log('Workflow', 'Create', `Found ${autoConnections.length} auto, ${aiDecideConnections.length} ai-decide, and ${directConnections.length} direct connections for Pod "${sourcePod?.name ?? sourcePodId}"`);

    autoClearService.initializeWorkflowTracking(canvasId, sourcePodId);

    await Promise.allSettled([
      ...autoConnections.map(connection =>
        this.autoTriggerService!.processAutoTriggerConnection(canvasId, sourcePodId, connection)
      ),
      aiDecideConnections.length > 0
        ? this.aiDecideTriggerService!.processAiDecideConnections(canvasId, sourcePodId, aiDecideConnections)
        : Promise.resolve(),
      ...directConnections.map(connection => {
        const pipelineContext: PipelineContext = {
          canvasId,
          sourcePodId,
          connection,
          triggerMode: 'direct',
          decideResult: { connectionId: connection.id, approved: true, reason: null },
        };
        return this.pipeline!.execute(pipelineContext, this.directTriggerService!);
      }),
    ]);
  }

  async triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    strategy: TriggerStrategy
  ): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    logger.log('Workflow', 'Create', `觸發工作流程：Pod ${sourcePodId} → Pod ${targetPodId}`);

    const triggerMode = connection.triggerMode;
    if (triggerMode === 'auto' || triggerMode === 'ai-decide') {
        forEachMultiInputGroupConnection(canvasId, targetPodId, (conn) => {
            connectionStore.updateConnectionStatus(canvasId, conn.id, 'active');
        });
    } else {
        connectionStore.updateConnectionStatus(canvasId, connectionId, 'active');
    }

    strategy.onTrigger({
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      summary,
      isSummarized,
    });

    podStore.setStatus(canvasId, targetPodId, 'chatting');
    this.executeClaudeQuery(canvasId, connectionId, sourcePodId, targetPodId, summary, strategy).catch(error =>
      logger.error('Workflow', 'Error', `executeClaudeQuery 執行失敗 (connection: ${connectionId})`, error)
    );
  }

  private scheduleNextInQueue(canvasId: string, targetPodId: string): void {
    workflowQueueService.processNextInQueue(canvasId, targetPodId).catch(error => {
      logger.error('Workflow', 'Error', `處理佇列下一項時發生錯誤: ${error}`);
    });
  }

  private async executeClaudeQuery(
    canvasId: string,
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    content: string,
    strategy: TriggerStrategy
  ): Promise<void> {
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
      { canvasId, podId: targetPodId, message: messageToSend, connectionId: SystemConnectionIds.WORKFLOW, supportAbort: false },
      {
        onComplete: async () => {
          strategy.onComplete(
            { canvasId, connectionId, sourcePodId, targetPodId, triggerMode: strategy.mode },
            true
          );
          logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);
          await autoClearService.onPodComplete(canvasId, targetPodId);
          this.checkAndTriggerWorkflows(canvasId, targetPodId).catch(error =>
            logger.error('Workflow', 'Error', `下游 workflow 觸發失敗 (pod: ${targetPodId})`, error)
          );
          this.scheduleNextInQueue(canvasId, targetPodId);
        },
        onError: async (_canvasId, _podId, error) => {
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
