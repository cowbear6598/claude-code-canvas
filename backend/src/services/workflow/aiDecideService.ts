import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { aiDecidePromptBuilder, type AiDecideTargetInfo } from './aiDecidePromptBuilder.js';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';
import { outputStyleService } from '../outputStyleService.js';
import { commandService } from '../commandService.js';
import { disposableChatService } from '../claude/disposableChatService.js';
import { summaryPromptBuilder } from '../summaryPromptBuilder.js';
import type { Connection } from '../../types';
import { logger } from '../../utils/logger.js';

export interface AiDecideResult {
  connectionId: string;
  shouldTrigger: boolean;
  reason: string;
}

export interface AiDecideBatchResult {
  results: AiDecideResult[];
  errors: Array<{ connectionId: string; error: string }>;
}

class AiDecideService {
  async decideConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[]
  ): Promise<AiDecideBatchResult> {
    // 空陣列直接回傳
    if (connections.length === 0) {
      return { results: [], errors: [] };
    }

    try {
      // 1. 生成 source Pod 的簡化摘要
      const sourceSummary = await this.generateSourceSummary(canvasId, sourcePodId);
      if (!sourceSummary) {
        return {
          results: [],
          errors: connections.map(conn => ({
            connectionId: conn.id,
            error: 'Failed to generate source summary',
          })),
        };
      }

      // 2. 取得 source Pod 資訊
      const sourcePod = podStore.getById(canvasId, sourcePodId);
      if (!sourcePod) {
        return {
          results: [],
          errors: connections.map(conn => ({
            connectionId: conn.id,
            error: 'Source Pod not found',
          })),
        };
      }

      // 3. 建構所有 target 的資訊
      const targets: AiDecideTargetInfo[] = [];
      for (const conn of connections) {
        const targetPod = podStore.getById(canvasId, conn.targetPodId);
        if (!targetPod) {
          logger.log('Workflow', 'Update', `[AiDecideService] Target Pod ${conn.targetPodId} not found`);
          continue;
        }

        let targetPodOutputStyle: string | null = null;
        if (targetPod.outputStyleId) {
          targetPodOutputStyle = await outputStyleService.getContent(targetPod.outputStyleId);
        }

        let targetPodCommand: string | null = null;
        if (targetPod.commandId) {
          targetPodCommand = await commandService.getContent(targetPod.commandId);
        }

        targets.push({
          connectionId: conn.id,
          targetPodId: conn.targetPodId,
          targetPodName: targetPod.name,
          targetPodOutputStyle,
          targetPodCommand,
        });
      }

      if (targets.length === 0) {
        return {
          results: [],
          errors: connections.map(conn => ({
            connectionId: conn.id,
            error: 'No valid target pods found',
          })),
        };
      }

      // 4. 建構 prompt
      const context = {
        sourcePodName: sourcePod.name,
        sourceSummary,
        targets,
      };
      const systemPrompt = aiDecidePromptBuilder.buildSystemPrompt();
      const userPrompt = aiDecidePromptBuilder.buildUserPrompt(context);

      // 5. 定義 Custom Tool
      const decideTriggersSchema = {
        decisions: z.array(
          z.object({
            connectionId: z.string(),
            shouldTrigger: z.boolean(),
            reason: z.string(),
          })
        ),
      };

      type DecisionResults = {
        decisions: Array<{
          connectionId: string;
          shouldTrigger: boolean;
          reason: string;
        }>;
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

      // 6. 使用 Claude Agent SDK 發送請求
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

      // 消耗 stream
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _sdkMessage of queryStream) {
        // 只需等待 tool 被呼叫
      }

      // 7. 處理 AI 的判斷結果
      if (!decisionResults) {
        logger.error('Workflow', 'Error', '[AiDecideService] Custom Tool handler was not called');
        return {
          results: [],
          errors: connections.map(conn => ({
            connectionId: conn.id,
            error: 'AI decision tool was not executed',
          })),
        };
      }

      const typedResults = decisionResults as DecisionResults;
      if (!typedResults.decisions || !Array.isArray(typedResults.decisions)) {
        logger.error('Workflow', 'Error', '[AiDecideService] Invalid decision results format');
        return {
          results: [],
          errors: connections.map(conn => ({
            connectionId: conn.id,
            error: 'Invalid AI decision format',
          })),
        };
      }

      // 8. 比對每條 connection 是否都有對應的判斷結果
      const results: AiDecideResult[] = [];
      const errors: Array<{ connectionId: string; error: string }> = [];

      const decisions = typedResults.decisions;

      for (const conn of connections) {
        const decision = decisions.find((d: { connectionId: string; shouldTrigger: boolean; reason: string }) => d.connectionId === conn.id);
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
    } catch (error) {
      logger.error('Workflow', 'Error', '[AiDecideService] Claude API request failed', error);
      return {
        results: [],
        errors: connections.map(conn => ({
          connectionId: conn.id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  /**
   * 生成 source Pod 的簡化摘要
   */
  private async generateSourceSummary(canvasId: string, sourcePodId: string): Promise<string | null> {
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      return null;
    }

    const messages = messageStore.getMessages(sourcePodId);
    if (messages.length === 0) {
      return null;
    }

    // 使用 summaryPromptBuilder 格式化對話歷史
    const conversationHistory = summaryPromptBuilder.formatConversationHistory(messages);

    let sourcePodOutputStyle: string | null = null;
    if (sourcePod.outputStyleId) {
      sourcePodOutputStyle = await outputStyleService.getContent(sourcePod.outputStyleId);
    }

    // 建構簡化的摘要 prompt（不指定 target）
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

      // Fallback: 使用最後一條 assistant 訊息
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length > 0) {
        return assistantMessages[assistantMessages.length - 1].content;
      }

      return null;
    }

    return result.content;
  }
}

export const aiDecideService = new AiDecideService();
