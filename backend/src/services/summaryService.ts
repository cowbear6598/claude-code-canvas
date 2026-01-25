import { claudeQueryService, type StreamCallback } from './claude/queryService.js';
import { disposableChatService } from './claude/disposableChatService.js';
import { summaryPromptBuilder } from './summaryPromptBuilder.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { outputStyleService } from './outputStyleService.js';

export interface TargetSummaryResult {
  targetPodId: string;
  summary: string;
  success: boolean;
  error?: string;
}

class SummaryService {
  /**
   * @deprecated Use generateSummaryForTarget instead
   * Generate summary using the source POD's AI session with context
   * @param sourcePodId - The ID of the source POD
   * @param onStream - Callback for streaming events
   * @returns Promise with the summarized content
   */
  async generateSummaryWithSession(
    sourcePodId: string,
    onStream?: StreamCallback
  ): Promise<string> {
    const summaryPrompt = `請摘要我們目前的對話重點，給下一個處理者使用。請用繁體中文回應，並只輸出摘要內容，不要加上任何解釋或前綴。`;

    let summarizedContent = '';

    const streamCallback: StreamCallback = (event) => {
      if (event.type === 'text') {
        summarizedContent += event.content;
      }

      if (onStream) {
        onStream(event);
      }
    };

    await claudeQueryService.sendMessage(sourcePodId, summaryPrompt, streamCallback);

    return summarizedContent;
  }

  async generateSummaryForTarget(sourcePodId: string, targetPodId: string): Promise<TargetSummaryResult> {
    const sourcePod = podStore.getById(sourcePodId);
    if (!sourcePod) {
      return {
        targetPodId,
        summary: '',
        success: false,
        error: `Source Pod ${sourcePodId} not found`,
      };
    }

    const targetPod = podStore.getById(targetPodId);
    if (!targetPod) {
      return {
        targetPodId,
        summary: '',
        success: false,
        error: `Target Pod ${targetPodId} not found`,
      };
    }

    const messages = messageStore.getMessages(sourcePodId);
    if (messages.length === 0) {
      return {
        targetPodId,
        summary: '',
        success: false,
        error: `Source Pod ${sourcePodId} has no messages`,
      };
    }

    let sourcePodOutputStyle: string | null = null;
    if (sourcePod.outputStyleId) {
      sourcePodOutputStyle = await outputStyleService.getStyleContent(sourcePod.outputStyleId);
    }

    let targetPodOutputStyle: string | null = null;
    if (targetPod.outputStyleId) {
      targetPodOutputStyle = await outputStyleService.getStyleContent(targetPod.outputStyleId);
    }

    const conversationHistory = summaryPromptBuilder.formatConversationHistory(messages);

    const context = {
      sourcePodName: sourcePod.name,
      sourcePodOutputStyle,
      targetPodName: targetPod.name,
      targetPodOutputStyle,
      conversationHistory,
    };

    const systemPrompt = summaryPromptBuilder.buildSystemPrompt(sourcePodOutputStyle);
    const userPrompt = summaryPromptBuilder.buildUserPrompt(context);

    const result = await disposableChatService.executeDisposableChat({
      systemPrompt,
      userMessage: userPrompt,
      workspacePath: sourcePod.workspacePath,
    });

    if (!result.success) {
      console.error(`[SummaryService] Failed to generate summary for target ${targetPodId}: ${result.error}`);

      const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
      if (assistantMessages.length > 0) {
        const fallbackSummary = assistantMessages[assistantMessages.length - 1].content;
        console.log(`[SummaryService] Using fallback summary for target ${targetPodId}`);
        return {
          targetPodId,
          summary: fallbackSummary,
          success: true,
        };
      }

      return {
        targetPodId,
        summary: '',
        success: false,
        error: result.error,
      };
    }

    return {
      targetPodId,
      summary: result.content,
      success: true,
    };
  }

  async generateSummariesForAllTargets(
    sourcePodId: string,
    targetPodIds: string[]
  ): Promise<Map<string, TargetSummaryResult>> {
    const results = await Promise.allSettled(
      targetPodIds.map((targetPodId) => this.generateSummaryForTarget(sourcePodId, targetPodId))
    );

    const summaryMap = new Map<string, TargetSummaryResult>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        summaryMap.set(result.value.targetPodId, result.value);
      } else {
        console.error(`[SummaryService] Failed to generate summary:`, result.reason);
      }
    }

    return summaryMap;
  }
}

export const summaryService = new SummaryService();
