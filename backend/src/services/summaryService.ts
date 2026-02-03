import { disposableChatService } from './claude/disposableChatService.js';
import { summaryPromptBuilder } from './summaryPromptBuilder.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { outputStyleService } from './outputStyleService.js';
import { logger } from '../utils/logger.js';

interface TargetSummaryResult {
  targetPodId: string;
  summary: string;
  success: boolean;
  error?: string;
}

class SummaryService {
    async generateSummaryForTarget(canvasId: string, sourcePodId: string, targetPodId: string): Promise<TargetSummaryResult> {
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      return {
        targetPodId,
        summary: '',
        success: false,
        error: `Source Pod ${sourcePodId} not found`,
      };
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
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
      sourcePodOutputStyle = await outputStyleService.getContent(sourcePod.outputStyleId);
    }

    let targetPodOutputStyle: string | null = null;
    if (targetPod.outputStyleId) {
      targetPodOutputStyle = await outputStyleService.getContent(targetPod.outputStyleId);
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
      logger.error('Workflow', 'Error', `[SummaryService] Failed to generate summary for target ${targetPodId}: ${result.error}`);

      const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
      if (assistantMessages.length > 0) {
        const fallbackSummary = assistantMessages[assistantMessages.length - 1].content;
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
}

export const summaryService = new SummaryService();
