// Claude Query Service
// Handles Claude Agent SDK queries and streaming with conversation persistence
// Uses Claude Code CLI authentication (no API key required)

import { v4 as uuidv4 } from 'uuid';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';
import { Message, ToolUseInfo } from '../../types/index.js';

// Stream Event Types
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
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolResultStreamEvent {
  type: 'tool_result';
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

// Stream callback type
export type StreamCallback = (event: StreamEvent) => void;

class ClaudeQueryService {
  /**
   * Send a message to Claude and process the response stream
   * @param podId Pod identifier
   * @param message User message text
   * @param onStream Callback for streaming events
   * @returns Complete Message object
   */
  async sendMessage(
    podId: string,
    message: string,
    onStream: StreamCallback
  ): Promise<Message> {
    // Get Pod
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod ${podId} not found`);
    }

    // Generate message ID
    const messageId = uuidv4();

    // Track tool use information
    let toolUseInfo: ToolUseInfo | null = null;
    let fullContent = '';
    let capturedSessionId: string | null = null;

    try {
      // Save user message to history
      await messageStore.addMessage(podId, 'user', message);

      // Get Pod's Claude session ID for resume
      const resumeSessionId = pod.claudeSessionId;

      // Create Claude query with workspace configuration and optional resume
      // Uses Claude Code CLI authentication automatically
      const queryOptions: Options = {
        cwd: pod.workspacePath,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
      };

      // Add resume option if we have a session ID
      if (resumeSessionId) {
        queryOptions.resume = resumeSessionId;
        console.log(`[QueryService] Resuming session ${resumeSessionId} for Pod ${podId}`);
      } else {
        console.log(`[QueryService] Starting new session for Pod ${podId}`);
      }

      const queryStream = query({
        prompt: message,
        options: queryOptions,
      });

      // Process stream
      for await (const sdkMessage of queryStream) {
        // Handle system init messages to capture session ID
        if (
          sdkMessage.type === 'system' &&
          'subtype' in sdkMessage &&
          sdkMessage.subtype === 'init' &&
          'session_id' in sdkMessage
        ) {
          capturedSessionId = (sdkMessage as { session_id: string }).session_id;
          console.log(`[QueryService] Captured session ID: ${capturedSessionId}`);
        }
        // Handle assistant messages
        else if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
          for (const block of sdkMessage.message.content) {
            // Text content
            if ('text' in block && block.text) {
              fullContent += block.text;
              onStream({
                type: 'text',
                content: block.text,
              });
            }
            // Tool use
            else if ('type' in block && block.type === 'tool_use') {
              const toolBlock = block as {
                type: 'tool_use';
                name: string;
                input: Record<string, unknown>;
              };

              toolUseInfo = {
                toolName: toolBlock.name,
                input: toolBlock.input,
                output: null,
              };

              onStream({
                type: 'tool_use',
                toolName: toolBlock.name,
                input: toolBlock.input,
              });
            }
          }
        }
        // Handle tool progress messages
        else if (sdkMessage.type === 'tool_progress') {
          // Tool progress might contain result information
          const toolProgressMsg = sdkMessage as { output?: string; result?: string };
          if (toolProgressMsg.output || toolProgressMsg.result) {
            const outputText = toolProgressMsg.output || toolProgressMsg.result || '';

            // Update tool use info
            if (toolUseInfo) {
              toolUseInfo.output = outputText;
            }

            // Emit tool result event
            onStream({
              type: 'tool_result',
              toolName: toolUseInfo?.toolName || 'unknown',
              output: outputText,
            });
          }
        }
        // Handle result messages
        else if (sdkMessage.type === 'result') {
          if (sdkMessage.subtype === 'success') {
            // Final result
            fullContent = sdkMessage.result || fullContent;

            onStream({
              type: 'complete',
            });
          } else {
            // Error result
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
        // Handle partial messages (streaming)
        else if (sdkMessage.type === 'stream_event') {
          // Handle streaming events if needed
          // For now, we rely on assistant messages for content
        }
      }

      // Store captured session ID
      if (capturedSessionId && capturedSessionId !== pod.claudeSessionId) {
        console.log(`[QueryService] Storing session ID ${capturedSessionId} for Pod ${podId}`);
        podStore.setClaudeSessionId(podId, capturedSessionId);
      }

      // Save assistant message to history
      if (fullContent) {
        await messageStore.addMessage(podId, 'assistant', fullContent);
      }

      // Create and return complete Message object
      const completeMessage: Message = {
        id: messageId,
        podId,
        role: 'assistant',
        content: fullContent,
        toolUse: toolUseInfo,
        createdAt: new Date(),
      };

      return completeMessage;
    } catch (error) {
      // Check if it's a session resume failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isResumeError =
        errorMessage.includes('session') || errorMessage.includes('resume');

      if (isResumeError && pod.claudeSessionId) {
        console.warn(
          `[QueryService] Session resume failed for Pod ${podId}, clearing session ID and retrying`
        );

        // Clear invalid session ID
        podStore.setClaudeSessionId(podId, '');

        // Retry without resume (recursive call)
        // Note: This will create a new session automatically
        return this.sendMessage(podId, message, onStream);
      }

      // Emit error event
      onStream({
        type: 'error',
        error: errorMessage,
      });

      throw error;
    }
  }
}

// Export singleton instance
export const claudeQueryService = new ClaudeQueryService();
