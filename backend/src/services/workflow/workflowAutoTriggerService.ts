import type { Connection } from '../../types/index.js';
import type { TriggerStrategy, TriggerDecideContext, TriggerDecideResult, PipelineContext } from './types.js';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';
import { logger } from '../../utils/logger.js';

// 定義 Pipeline 介面（避免循環依賴）
interface Pipeline {
  execute(context: PipelineContext, strategy: TriggerStrategy): Promise<void>;
}

class WorkflowAutoTriggerService implements TriggerStrategy {
  readonly mode = 'auto' as const;
  private pipeline?: Pipeline;

  /**
   * 初始化依賴
   */
  init(deps: { pipeline: Pipeline }): void {
    this.pipeline = deps.pipeline;
  }

  /**
   * 決策階段：Auto 模式永遠批准所有連線
   */
  async decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]> {
    return context.connections.map((conn) => ({
      connectionId: conn.id,
      approved: true,
      reason: null,
    }));
  }

  /**
   * 取得最後一則 Assistant 訊息（用於備用內容）
   */
  getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      logger.error('Workflow', 'Error', '找不到 assistant 訊息作為備用內容');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }

  /**
   * 處理自動觸發連線（已重構為使用 Pipeline）
   */
  async processAutoTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection
  ): Promise<void> {
    if (!this.pipeline) {
      throw new Error('AutoTriggerService 尚未初始化，請先呼叫 init()');
    }

    // 安全檢查：確認目標 Pod 存在
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (!targetPod) {
      logger.log('Workflow', 'Error', `目標 Pod ${connection.targetPodId} 不存在，跳過自動觸發`);
      return;
    }

    // 建立 Pipeline 上下文
    const pipelineContext: PipelineContext = {
      canvasId,
      sourcePodId,
      connection,
      triggerMode: 'auto',
      decideResult: {
        connectionId: connection.id,
        approved: true,
        reason: null,
      },
    };

    // 交由 Pipeline 統一處理（多輸入/佇列/觸發）
    try {
      await this.pipeline.execute(pipelineContext, this);
    } catch (error) {
      logger.error('Workflow', 'Error', `自動觸發工作流程 ${connection.id} 失敗`, error);
    }
  }
}

export const workflowAutoTriggerService = new WorkflowAutoTriggerService();
