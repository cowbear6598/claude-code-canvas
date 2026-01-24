import { claudeQueryService, type StreamCallback } from './claude/queryService.js';

class SummaryService {
  /**
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

      // Forward stream events to the provided callback
      if (onStream) {
        onStream(event);
      }
    };

    await claudeQueryService.sendMessage(sourcePodId, summaryPrompt, streamCallback);

    return summarizedContent;
  }
}

export const summaryService = new SummaryService();
