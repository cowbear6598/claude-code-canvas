import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { type Options, query } from '@anthropic-ai/claude-agent-sdk';
import { podStore } from '../podStore.js';
import { outputStyleService } from '../outputStyleService.js';
import { Message, ToolUseInfo, ContentBlock } from '../../types/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

type ClaudeTextContent = {
  type: 'text';
  text: string;
};

type ClaudeImageContent = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};

type ClaudeMessageContent = ClaudeTextContent | ClaudeImageContent;

type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: ClaudeMessageContent[];
  };
  parent_tool_use_id: null;
  session_id: string;
};

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

function buildClaudeContentBlocks(
  message: ContentBlock[],
  commandId: string | null
): ClaudeMessageContent[] {
  const contentArray: ClaudeMessageContent[] = [];
  let isFirstTextBlock = true;

  for (const block of message) {
    if (block.type === 'text') {
      let text = block.text;
      if (isFirstTextBlock && commandId) {
        text = `/${commandId} ${text}`;
        isFirstTextBlock = false;
      }
      contentArray.push({
        type: 'text',
        text,
      });
    } else if (block.type === 'image') {
      contentArray.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.mediaType,
          data: block.base64Data,
        },
      });
    }
  }

  return contentArray;
}

function createUserMessageStream(
  content: ClaudeMessageContent[],
  sessionId: string
): AsyncIterable<SDKUserMessage> {
  return (async function* (): AsyncGenerator<SDKUserMessage, void, undefined> {
    yield {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content,
      },
      parent_tool_use_id: null,
      session_id: sessionId,
    };
  })();
}

class ClaudeQueryService {
  private buildPrompt(
    message: string | ContentBlock[],
    commandId: string | null,
    resumeSessionId: string | null
  ): string | AsyncIterable<SDKUserMessage> {
    if (typeof message === 'string') {
      return commandId ? `/${commandId} ${message}` : message;
    }

    const contentArray = buildClaudeContentBlocks(message, commandId);
    const sessionId = resumeSessionId || '';
    return createUserMessageStream(contentArray, sessionId);
  }

  private processSDKMessage(
    sdkMessage: unknown,
    capturedSessionIdRef: { value: string | null },
    fullContentRef: { value: string },
    toolUseInfoRef: { value: ToolUseInfo | null },
    activeTools: Map<string, { toolName: string; input: Record<string, unknown> }>,
    onStream: StreamCallback
  ): void {
    const msg = sdkMessage as Record<string, unknown>;

    if (
      msg.type === 'system' &&
      'subtype' in msg &&
      msg.subtype === 'init' &&
      'session_id' in msg
    ) {
      capturedSessionIdRef.value = msg.session_id as string;
      return;
    }

    if (msg.type === 'assistant' && 'message' in msg) {
      const assistantMsg = msg.message as { content?: unknown[] };
      if (!assistantMsg.content) return;

      for (const block of assistantMsg.content) {
        const contentBlock = block as Record<string, unknown>;

        if ('text' in contentBlock && contentBlock.text) {
          const text = String(contentBlock.text);
          fullContentRef.value += text;
          onStream({
            type: 'text',
            content: text,
          });
        } else if ('type' in contentBlock && contentBlock.type === 'tool_use') {
          const toolBlock = contentBlock as {
            id: string;
            name: string;
            input: Record<string, unknown>;
          };

          activeTools.set(toolBlock.id, {
            toolName: toolBlock.name,
            input: toolBlock.input,
          });

          toolUseInfoRef.value = {
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
      return;
    }

    if (msg.type === 'tool_progress') {
      const toolProgressMsg = msg as {
        output?: string;
        result?: string;
        tool_use_id?: string;
      };

      const outputText = toolProgressMsg.output || toolProgressMsg.result;
      if (!outputText) return;

      const toolUseId = toolProgressMsg.tool_use_id;
      const toolInfo = toolUseId ? activeTools.get(toolUseId) : null;

      if (toolInfo && toolUseId) {
        if (toolUseInfoRef.value && toolUseInfoRef.value.toolUseId === toolUseId) {
          toolUseInfoRef.value.output = outputText;
        }

        onStream({
          type: 'tool_result',
          toolUseId,
          toolName: toolInfo.toolName,
          output: outputText,
        });
      } else if (toolUseInfoRef.value) {
        toolUseInfoRef.value.output = outputText;

        onStream({
          type: 'tool_result',
          toolUseId: toolUseInfoRef.value.toolUseId,
          toolName: toolUseInfoRef.value.toolName,
          output: outputText,
        });
      }
      return;
    }

    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        if (!fullContentRef.value && 'result' in msg && msg.result) {
          fullContentRef.value = String(msg.result);
        }

        onStream({
          type: 'complete',
        });
      } else {
        const errorMessage =
          'errors' in msg && Array.isArray(msg.errors)
            ? msg.errors.join(', ')
            : 'Unknown error';

        onStream({
          type: 'error',
          error: errorMessage,
        });

        throw new Error(errorMessage);
      }
    }
  }

  async sendMessage(
    podId: string,
    message: string | ContentBlock[],
    onStream: StreamCallback
  ): Promise<Message> {
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`找不到 Pod ${podId}`);
    }

    const messageId = uuidv4();
    const capturedSessionIdRef = { value: null as string | null };
    const fullContentRef = { value: '' };
    const toolUseInfoRef = { value: null as ToolUseInfo | null };
    const activeTools = new Map<string, { toolName: string; input: Record<string, unknown> }>();

    try {
      const resumeSessionId = pod.claudeSessionId;
      const cwd = pod.repositoryId
        ? path.join(config.repositoriesRoot, pod.repositoryId)
        : pod.workspacePath;

      const queryOptions: Options = {
        cwd,
        settingSources: ['project'],
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
      };

      if (pod.outputStyleId) {
        const styleContent = await outputStyleService.getContent(pod.outputStyleId);
        if (styleContent) {
          queryOptions.systemPrompt = styleContent;
        }
      }

      if (resumeSessionId) {
        queryOptions.resume = resumeSessionId;
      }

      queryOptions.model = pod.model;

      const prompt = this.buildPrompt(message, pod.commandId, resumeSessionId);

      const queryStream = query({
        prompt,
        options: queryOptions,
      });

      for await (const sdkMessage of queryStream) {
        this.processSDKMessage(
          sdkMessage,
          capturedSessionIdRef,
          fullContentRef,
          toolUseInfoRef,
          activeTools,
          onStream
        );
      }

      if (capturedSessionIdRef.value && capturedSessionIdRef.value !== pod.claudeSessionId) {
        podStore.setClaudeSessionId(podId, capturedSessionIdRef.value);
      }

      return {
        id: messageId,
        podId,
        role: 'assistant',
        content: fullContentRef.value,
        toolUse: toolUseInfoRef.value,
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
