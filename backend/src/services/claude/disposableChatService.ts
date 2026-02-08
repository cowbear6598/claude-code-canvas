import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errorHelpers.js';

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
                : '未知錯誤';

            return {
              content: '',
              success: false,
              error: errorMessage,
            };
          }
        }
      }

      return {
        content: fullContent,
        success: true,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Chat', 'Error', `[DisposableChatService] Failed`, error);

      return {
        content: '',
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const disposableChatService = new DisposableChatService();
