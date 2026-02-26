import { disposableChatService } from './claude/disposableChatService.js';
import { summaryPromptBuilder } from './summaryPromptBuilder.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { outputStyleService } from './outputStyleService.js';
import { commandService } from './commandService.js';
import { logger } from '../utils/logger.js';
import type { Pod, PersistedMessage } from '../types/index.js';

interface TargetSummaryResult {
  targetPodId: string;
  summary: string;
  success: boolean;
  error?: string;
}

async function buildSummaryContext(sourcePod: Pod, targetPod: Pod, messages: PersistedMessage[]): Promise<{
  sourcePodName: string;
  sourcePodOutputStyle: string | null;
  targetPodName: string;
  targetPodOutputStyle: string | null;
  targetPodCommand: string | null;
  conversationHistory: string;
}> {
  const sourcePodOutputStyle = sourcePod.outputStyleId
    ? await outputStyleService.getContent(sourcePod.outputStyleId)
    : null;

  const targetPodOutputStyle = targetPod.outputStyleId
    ? await outputStyleService.getContent(targetPod.outputStyleId)
    : null;

  const targetPodCommand = targetPod.commandId
    ? await commandService.getContent(targetPod.commandId)
    : null;

  const conversationHistory = summaryPromptBuilder.formatConversationHistory(messages);

  return {
    sourcePodName: sourcePod.name,
    sourcePodOutputStyle,
    targetPodName: targetPod.name,
    targetPodOutputStyle,
    targetPodCommand,
    conversationHistory,
  };
}

function getFallbackContent(messages: PersistedMessage[]): string | null {
  const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
  if (assistantMessages.length === 0) {
    return null;
  }
  return assistantMessages[assistantMessages.length - 1].content;
}

class SummaryService {
  async generateSummaryForTarget(canvasId: string, sourcePodId: string, targetPodId: string): Promise<TargetSummaryResult> {
    const sourcePod = podStore.getById(canvasId, sourcePodId);
    if (!sourcePod) {
      return { targetPodId, summary: '', success: false, error: `Source Pod ${sourcePodId} not found` };
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (!targetPod) {
      return { targetPodId, summary: '', success: false, error: `Target Pod ${targetPodId} not found` };
    }

    const messages = messageStore.getMessages(sourcePodId);
    if (messages.length === 0) {
      return { targetPodId, summary: '', success: false, error: `Source Pod ${sourcePodId} has no messages` };
    }

    const context = await buildSummaryContext(sourcePod, targetPod, messages);
    const systemPrompt = summaryPromptBuilder.buildSystemPrompt(context.sourcePodOutputStyle);
    const userPrompt = summaryPromptBuilder.buildUserPrompt(context);

    const result = await disposableChatService.executeDisposableChat({
      systemPrompt,
      userMessage: userPrompt,
      workspacePath: sourcePod.workspacePath,
    });

    if (!result.success) {
      logger.error('Workflow', 'Error', `[SummaryService] Failed to generate summary for target ${targetPodId}: ${result.error}`);

      const fallbackContent = getFallbackContent(messages);
      if (fallbackContent !== null) {
        return { targetPodId, summary: fallbackContent, success: true };
      }

      return { targetPodId, summary: '', success: false, error: result.error };
    }

    return { targetPodId, summary: result.content, success: true };
  }
}

export const summaryService = new SummaryService();
