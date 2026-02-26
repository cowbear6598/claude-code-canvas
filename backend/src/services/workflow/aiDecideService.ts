import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { aiDecidePromptBuilder, type AiDecideTargetInfo } from './aiDecidePromptBuilder.js';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';
import { outputStyleService } from '../outputStyleService.js';
import { commandService } from '../commandService.js';
import { disposableChatService } from '../claude/disposableChatService.js';
import { summaryPromptBuilder } from '../summaryPromptBuilder.js';
import type { Connection } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errorHelpers.js';

export interface AiDecideResult {
  connectionId: string;
  shouldTrigger: boolean;
  reason: string;
}

export interface AiDecideBatchResult {
  results: AiDecideResult[];
  errors: Array<{ connectionId: string; error: string }>;
}

type DecisionResults = {
  decisions: Array<{
    connectionId: string;
    shouldTrigger: boolean;
    reason: string;
  }>;
};

class AiDecideService {
  private buildDecisionErrors(
    connections: Connection[],
    error: string
  ): AiDecideBatchResult {
    return {
      results: [],
      errors: connections.map(conn => ({
        connectionId: conn.id,
        error,
      })),
    };
  }

  private async executeDecision(
    sourcePod: NonNullable<ReturnType<typeof podStore.getById>>,
    sourceSummary: string,
    targets: AiDecideTargetInfo[]
  ): Promise<DecisionResults | null> {
    const context = {
      sourcePodName: sourcePod.name,
      sourceSummary,
      targets,
    };
    const systemPrompt = aiDecidePromptBuilder.buildSystemPrompt();
    const userPrompt = aiDecidePromptBuilder.buildUserPrompt(context);

    const decideTriggersSchema = {
      decisions: z.array(
        z.object({
          connectionId: z.string(),
          shouldTrigger: z.boolean(),
          reason: z.string(),
        })
      ),
    };

    let decisionResults: DecisionResults | null = null;

    const decideTriggersTool = tool(
      'decide_triggers',
      '回傳 Workflow 觸發判斷結果',
      decideTriggersSchema,
      async (params: DecisionResults) => {
        decisionResults = params;
        return { success: true };
      }
    );

    const customServer = createSdkMcpServer({
      name: 'ai-decide',
      tools: [decideTriggersTool],
    });

    const queryStream = query({
      prompt: userPrompt,
      options: {
        systemPrompt,
        mcpServers: { 'ai-decide': customServer },
        allowedTools: ['mcp__ai-decide__decide_triggers'],
        model: 'sonnet',
        cwd: sourcePod.workspacePath,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _sdkMessage of queryStream) {
      // 只需等待 tool 被呼叫
    }

    return decisionResults;
  }

  private mapDecisionResults(
    connections: Connection[],
    decisionResults: DecisionResults
  ): AiDecideBatchResult {
    const results: AiDecideResult[] = [];
    const errors: Array<{ connectionId: string; error: string }> = [];

    for (const conn of connections) {
      const decision = decisionResults.decisions.find(
        (d: { connectionId: string; shouldTrigger: boolean; reason: string }) => d.connectionId === conn.id
      );
      if (decision) {
        results.push({
          connectionId: conn.id,
          shouldTrigger: decision.shouldTrigger,
          reason: decision.reason,
        });
      } else {
        errors.push({
          connectionId: conn.id,
          error: 'No decision returned for this connection',
        });
      }
    }

    return { results, errors };
  }

  async decideConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<AiDecideBatchResult> {
    if (connections.length === 0) {
      return { results: [], errors: [] };
    }

    const sourceSummary = await this.generateSourceSummary(canvasId, sourcePodId);
    if (!sourceSummary) {
      return this.buildDecisionErrors(connections, 'Failed to generate source summary');
    }

    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      return this.buildDecisionErrors(connections, 'Source Pod not found');
    }

    const targets = await this.buildTargetInfos(canvasId, connections);

    if (targets.length === 0) {
      return this.buildDecisionErrors(connections, 'No valid target pods found');
    }

    let decisionResults: DecisionResults | null = null;
    try {
      decisionResults = await this.executeDecision(sourcePod, sourceSummary, targets);
    } catch (error) {
      logger.error('Workflow', 'Error', '[AiDecideService] Claude API request failed', error);
      return this.buildDecisionErrors(connections, getErrorMessage(error));
    }

    if (!decisionResults) {
      logger.error('Workflow', 'Error', '[AiDecideService] Custom Tool handler was not called');
      return this.buildDecisionErrors(connections, 'AI decision tool was not executed');
    }

    if (!decisionResults.decisions || !Array.isArray(decisionResults.decisions)) {
      logger.error('Workflow', 'Error', '[AiDecideService] Invalid decision results format');
      return this.buildDecisionErrors(connections, 'Invalid AI decision format');
    }

    return this.mapDecisionResults(connections, decisionResults);
  }

  private async resolveTargetPodResources(
    targetPod: NonNullable<ReturnType<typeof podStore.getById>>,
    conn: Connection
  ): Promise<AiDecideTargetInfo> {
    const targetPodOutputStyle = targetPod.outputStyleId
      ? await outputStyleService.getContent(targetPod.outputStyleId)
      : null;

    const targetPodCommand = targetPod.commandId
      ? await commandService.getContent(targetPod.commandId)
      : null;

    return {
      connectionId: conn.id,
      targetPodId: conn.targetPodId,
      targetPodName: targetPod.name,
      targetPodOutputStyle,
      targetPodCommand,
    };
  }

  private async buildTargetInfos(
    canvasId: string,
    connections: Connection[]
  ): Promise<AiDecideTargetInfo[]> {
    const targets: AiDecideTargetInfo[] = [];

    for (const conn of connections) {
      const targetPod = podStore.getById(canvasId, conn.targetPodId);
      if (!targetPod) {
        logger.log('Workflow', 'Update', `[AiDecideService] Target Pod ${conn.targetPodId} not found`);
        continue;
      }

      targets.push(await this.resolveTargetPodResources(targetPod, conn));
    }

    return targets;
  }

  private getFallbackSummary(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter(message => message.role === 'assistant');
    return assistantMessages.length > 0
      ? assistantMessages[assistantMessages.length - 1].content
      : null;
  }

  private async generateSourceSummary(canvasId: string, sourcePodId: string): Promise<string | null> {
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) return null;

    const messages = messageStore.getMessages(sourcePodId);
    if (messages.length === 0) return null;

    const conversationHistory = summaryPromptBuilder.formatConversationHistory(messages);
    const sourcePodOutputStyle = sourcePod.outputStyleId
      ? await outputStyleService.getContent(sourcePod.outputStyleId)
      : null;

    const systemPrompt = `你是一個對話摘要助手。請將以下對話內容濃縮為簡短的摘要，重點放在最終產出和關鍵結論。`;
    const userPrompt = `# Pod 名稱
${sourcePod.name}

${sourcePodOutputStyle ? `# OutputStyle\n${sourcePodOutputStyle}\n\n` : ''}# 對話歷史
${conversationHistory}

請提供一個簡短的摘要（150字內），重點說明這個對話的主要產出和結論。`;

    const result = await disposableChatService.executeDisposableChat({
      systemPrompt,
      userMessage: userPrompt,
      workspacePath: sourcePod.workspacePath,
    });

    if (!result.success) {
      logger.log('Workflow', 'Update', `[AiDecideService] Failed to generate summary, using fallback`);
      return this.getFallbackSummary(sourcePodId);
    }

    return result.content;
  }
}

export const aiDecideService = new AiDecideService();
