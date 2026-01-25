import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

export interface DisposableChatOptions {
  systemPrompt: string;
  userMessage: string;
  workspacePath: string;
}

export interface DisposableChatResult {
  content: string;
  success: boolean;
  error?: string;
}

class DisposableChatService {
  async executeDisposableChat(options: DisposableChatOptions): Promise<DisposableChatResult> {
    const { systemPrompt, userMessage, workspacePath } = options;

    let fullContent = '';

    try {
      const queryOptions: Options = {
        cwd: workspacePath,
        settingSources: ['project'],
        allowedTools: [],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
        systemPrompt,
      };

      console.log(`[DisposableChatService] Executing disposable chat, prompt length: ${systemPrompt.length} chars`);

      const queryStream = query({
        prompt: userMessage,
        options: queryOptions,
      });

      for await (const sdkMessage of queryStream) {
        if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
          for (const block of sdkMessage.message.content) {
            if ('text' in block && block.text) {
              fullContent += block.text;
            }
          }
        } else if (sdkMessage.type === 'result') {
          if (sdkMessage.subtype === 'success') {
            fullContent = sdkMessage.result || fullContent;
          } else {
            const errorMessage =
              'errors' in sdkMessage && sdkMessage.errors
                ? sdkMessage.errors.join(', ')
                : 'Unknown error';

            return {
              content: '',
              success: false,
              error: errorMessage,
            };
          }
        }
      }

      console.log(`[DisposableChatService] Completed, response length: ${fullContent.length} chars`);

      return {
        content: fullContent,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DisposableChatService] Failed:`, error);

      return {
        content: '',
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const disposableChatService = new DisposableChatService();
