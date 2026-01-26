import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';

class WorkflowContentFormatter {
  formatMergedSummaries(summaries: Map<string, string>): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
      const sourcePod = podStore.getById(sourcePodId);
      const podName = sourcePod?.name || sourcePodId;

      formatted.push(`## Source: ${podName}\n${content}\n\n---`);
    }

    let result = formatted.join('\n\n');
    result = result.replace(/\n\n---$/, '');

    return result;
  }

  buildTransferMessage(content: string): string {
    return `以下是從另一個 POD 傳遞過來的內容,請根據這些資訊繼續處理:

---
${content}
---`;
  }

  getLastAssistantMessage(sourcePodId: string): string | null {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      console.error('[WorkflowContentFormatter] No assistant messages available for fallback');
      return null;
    }

    return assistantMessages[assistantMessages.length - 1].content;
  }
}

export const workflowContentFormatter = new WorkflowContentFormatter();
