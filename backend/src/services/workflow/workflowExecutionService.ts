import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents, SystemConnectionIds} from '../../schemas/index.js';
import type {
    WorkflowAutoTriggeredPayload
} from '../../types/index.js';
import type {
  PipelineContext,
  PipelineMethods,
  AiDecideMethods,
  AutoTriggerMethods,
  DirectTriggerMethods,
} from './types.js';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {socketService} from '../socketService.js';
import {summaryService} from '../summaryService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {workflowQueueService} from './workflowQueueService.js';
import {autoClearService} from '../autoClear/index.js';
import {logger} from '../../utils/logger.js';
import {commandService} from '../commandService.js';
import {executeStreamingChat} from '../claude/streamingChatExecutor.js';
import {
    buildTransferMessage,
    buildMessageWithCommand,
} from './workflowHelpers.js';
import {workflowAutoTriggerService} from './workflowAutoTriggerService.js';

class WorkflowExecutionService {
  private pipeline?: PipelineMethods;
  private aiDecideTriggerService?: AiDecideMethods;
  private autoTriggerService?: AutoTriggerMethods;
  private directTriggerService?: DirectTriggerMethods;

  /**
   * 初始化依賴（延遲注入，避免循環依賴）
   */
  init(deps: {
    pipeline: PipelineMethods;
    aiDecideTriggerService: AiDecideMethods;
    autoTriggerService: AutoTriggerMethods;
    directTriggerService: DirectTriggerMethods;
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
      // Auto: 平行處理所有 auto connections
      ...autoConnections.map(connection =>
        this.autoTriggerService!.processAutoTriggerConnection(canvasId, sourcePodId, connection)
      ),
      // AI-Decide: 批次處理
      aiDecideConnections.length > 0
        ? this.aiDecideTriggerService!.processAiDecideConnections(canvasId, sourcePodId, aiDecideConnections)
        : Promise.resolve(),
      // Direct: 平行處理所有 direct connections
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

  async triggerWorkflowInternal(canvasId: string, connectionId: string): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const { sourcePodId, targetPodId } = connection;

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      throw new Error(`Pod not found: ${sourcePodId}`);
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      throw new Error(`Pod not found: ${targetPodId}`);
    }

    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
    if (assistantMessages.length === 0) {
      throw new Error(`Source Pod ${sourcePodId} has no assistant messages to transfer`);
    }

    const result = await this.generateSummaryWithFallback(canvasId, sourcePodId, targetPodId);
    if (!result) {
      throw new Error('無可用的備用內容');
    }

    const transferredContent = result.content;
    const isSummarized = result.isSummarized;

    logger.log('Workflow', 'Create', `Auto-triggering workflow from Pod "${sourcePod.name}" to Pod "${targetPod.name}" (summarized: ${isSummarized})`);

    const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, sourcePodId, targetPodId, autoTriggeredPayload);
    workflowEventEmitter.emitWorkflowTriggered(
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized
    );

    podStore.setStatus(canvasId, targetPodId, 'chatting');
    this.executeClaudeQuery(canvasId, connectionId, sourcePodId, targetPodId, transferredContent).catch(error =>
      logger.error('Workflow', 'Error', `executeClaudeQuery 執行失敗 (connection: ${connectionId})`, error)
    );
  }

  async triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    skipAutoTriggeredEvent: boolean = false
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

    logger.log('Workflow', 'Create', `Triggering workflow with pre-generated summary from Pod ${sourcePodId} to Pod ${targetPodId}`);

    if (!skipAutoTriggeredEvent) {
      const autoTriggeredPayload: WorkflowAutoTriggeredPayload = {
        connectionId,
        sourcePodId,
        targetPodId,
        transferredContent: summary,
        isSummarized,
      };

      workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, sourcePodId, targetPodId, autoTriggeredPayload);
    }

    workflowEventEmitter.emitWorkflowTriggered(
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      summary,
      isSummarized
    );

    podStore.setStatus(canvasId, targetPodId, 'chatting');
    this.executeClaudeQuery(canvasId, connectionId, sourcePodId, targetPodId, summary).catch(error =>
      logger.error('Workflow', 'Error', `executeClaudeQuery 執行失敗 (connection: ${connectionId})`, error)
    );
  }

  /**
   * 排程下一個佇列項目（fire-and-forget）
   */
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
    content: string
  ): Promise<void> {
    const connection = connectionStore.getById(canvasId, connectionId);
    const triggerMode = connection?.triggerMode ?? 'auto';

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
          workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, true, undefined, triggerMode);
          logger.log('Workflow', 'Complete', `Completed workflow for connection ${connectionId}, target Pod "${targetPod?.name ?? targetPodId}"`);
          await autoClearService.onPodComplete(canvasId, targetPodId);
          connectionStore.updateConnectionStatus(canvasId, connectionId, 'idle');
          this.checkAndTriggerWorkflows(canvasId, targetPodId).catch(error =>
            logger.error('Workflow', 'Error', `下游 workflow 觸發失敗 (pod: ${targetPodId})`, error)
          );
          this.scheduleNextInQueue(canvasId, targetPodId);
        },
        onError: async (_canvasId, _podId, error) => {
          const errorMessage = error.message;
          workflowEventEmitter.emitWorkflowComplete(canvasId, connectionId, sourcePodId, targetPodId, false, errorMessage, triggerMode);
          logger.error('Workflow', 'Error', 'Failed to complete workflow', error);
          podStore.setStatus(canvasId, targetPodId, 'idle');
          connectionStore.updateConnectionStatus(canvasId, connectionId, 'idle');
          this.scheduleNextInQueue(canvasId, targetPodId);
        },
      }
    );
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
