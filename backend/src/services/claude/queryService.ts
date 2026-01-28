import {v4 as uuidv4} from 'uuid';
import path from 'path';
import {type Options, query} from '@anthropic-ai/claude-agent-sdk';
import {podStore} from '../podStore.js';
import {messageStore} from '../messageStore.js';
import {outputStyleService} from '../outputStyleService.js';
import {Message, ToolUseInfo} from '../../types/index.js';
import {config} from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export type StreamEvent =
  | TextStreamEvent
  | ToolUseStreamEvent
  | ToolResultStreamEvent
  | CompleteStreamEvent
  | ErrorStreamEvent;

export interface TextStreamEvent {
  type: 'text';
  content: string;
}

export interface ToolUseStreamEvent {
  type: 'tool_use';
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolResultStreamEvent {
  type: 'tool_result';
  toolUseId: string;
  toolName: string;
  output: string;
}

export interface CompleteStreamEvent {
  type: 'complete';
}

export interface ErrorStreamEvent {
  type: 'error';
  error: string;
}

export type StreamCallback = (event: StreamEvent) => void;

class ClaudeQueryService {
  async sendMessage(
    podId: string,
    message: string,
    onStream: StreamCallback
  ): Promise<Message> {
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`找不到 Pod ${podId}`);
    }

    const messageId = uuidv4();
    let toolUseInfo: ToolUseInfo | null = null;
    let fullContent = '';
    let capturedSessionId: string | null = null;
    const activeTools = new Map<string, { toolName: string; input: Record<string, unknown> }>();

    try {
      await messageStore.addMessage(podId, 'user', message);

      const resumeSessionId = pod.claudeSessionId;

      const cwd = pod.repositoryId
        ? path.join(config.repositoriesRoot, pod.repositoryId)
        : pod.workspacePath;

      // Intentionally not logging - too verbose

      const queryOptions: Options = {
        cwd,
        settingSources: ['project'],
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
      };

      if (pod.outputStyleId) {
        const styleContent = await outputStyleService.getStyleContent(pod.outputStyleId);
        if (styleContent) {
          queryOptions.systemPrompt = styleContent;
        }
      }

      if (resumeSessionId) {
        queryOptions.resume = resumeSessionId;
      }

      queryOptions.model = pod.model;

      const queryStream = query({
        prompt: message,
        options: queryOptions,
      });

      // Claude SDK 會發送多種類型的訊息（system init、assistant、tool_progress、result 等），
      // 需要分別處理以擷取 session ID、文字內容、工具使用資訊和最終結果
      for await (const sdkMessage of queryStream) {
        if (
          sdkMessage.type === 'system' &&
          'subtype' in sdkMessage &&
          sdkMessage.subtype === 'init' &&
          'session_id' in sdkMessage
        ) {
          capturedSessionId = (sdkMessage as { session_id: string }).session_id;
        }
        else if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
          for (const block of sdkMessage.message.content) {
            if ('text' in block && block.text) {
              fullContent += block.text;
              onStream({
                type: 'text',
                content: block.text,
              });
            }
            else if ('type' in block && block.type === 'tool_use') {
              const toolBlock = block as {
                type: 'tool_use';
                id: string;
                name: string;
                input: Record<string, unknown>;
              };

              activeTools.set(toolBlock.id, {
                toolName: toolBlock.name,
                input: toolBlock.input,
              });

              toolUseInfo = {
                toolUseId: toolBlock.id,
                toolName: toolBlock.name,
                input: toolBlock.input,
                output: null,
              };

              onStream({
                type: 'tool_use',
                toolUseId: toolBlock.id,
                toolName: toolBlock.name,
                input: toolBlock.input,
              });
            }
          }
        }
        else if (sdkMessage.type === 'tool_progress') {
          const toolProgressMsg = sdkMessage as {
            output?: string;
            result?: string;
            tool_use_id?: string;
          };

          if (toolProgressMsg.output || toolProgressMsg.result) {
            const outputText = toolProgressMsg.output || toolProgressMsg.result || '';
            const toolUseId = toolProgressMsg.tool_use_id;

            if (toolUseId && activeTools.has(toolUseId)) {
              const toolInfo = activeTools.get(toolUseId)!;

              if (toolUseInfo && toolUseInfo.toolUseId === toolUseId) {
                toolUseInfo.output = outputText;
              }

              onStream({
                type: 'tool_result',
                toolUseId,
                toolName: toolInfo.toolName,
                output: outputText,
              });
            } else if (toolUseInfo) {
              toolUseInfo.output = outputText;

              onStream({
                type: 'tool_result',
                toolUseId: toolUseInfo.toolUseId,
                toolName: toolUseInfo.toolName,
                output: outputText,
              });
            }
          }
        }
        else if (sdkMessage.type === 'result') {
          if (sdkMessage.subtype === 'success') {
            fullContent = sdkMessage.result || fullContent;

            onStream({
              type: 'complete',
            });
          } else {
            const errorMessage =
              'errors' in sdkMessage && sdkMessage.errors
                ? sdkMessage.errors.join(', ')
                : 'Unknown error';

            onStream({
              type: 'error',
              error: errorMessage,
            });

            throw new Error(errorMessage);
          }
        }
        else if (sdkMessage.type === 'stream_event') {
          // Ignore stream events
        }
      }

      if (capturedSessionId && capturedSessionId !== pod.claudeSessionId) {
        podStore.setClaudeSessionId(podId, capturedSessionId);
      }

      if (fullContent) {
        await messageStore.addMessage(podId, 'assistant', fullContent);
      }

      return {
          id: messageId,
          podId,
          role: 'assistant',
          content: fullContent,
          toolUse: toolUseInfo,
          createdAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isResumeError =
        errorMessage.includes('session') || errorMessage.includes('resume');

      if (!isResumeError || !pod.claudeSessionId) {
        onStream({
          type: 'error',
          error: errorMessage,
        });

        throw error;
      }

      logger.log(
        'Chat',
        'Update',
        `[QueryService] Session resume failed for Pod ${podId}, clearing session ID and retrying`
      );

      podStore.setClaudeSessionId(podId, '');

      return this.sendMessage(podId, message, onStream);
    }
  }
}

export const claudeQueryService = new ClaudeQueryService();
