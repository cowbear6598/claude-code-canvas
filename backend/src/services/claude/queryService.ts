import {v4 as uuidv4} from 'uuid';
import path from 'path';
import {type Options, type Query, query, AbortError} from '@anthropic-ai/claude-agent-sdk';
import {podStore} from '../podStore.js';
import {outputStyleService} from '../outputStyleService.js';
import {Message, ToolUseInfo, ContentBlock} from '../../types';
import {config} from '../../config';
import {logger} from '../../utils/logger.js';
import {
    buildClaudeContentBlocks,
    createUserMessageStream,
    type SDKUserMessage,
} from './messageBuilder.js';

export type StreamEvent =
    | TextStreamEvent
    | ToolUseStreamEvent
    | ToolResultStreamEvent
    | CompleteStreamEvent
    | ErrorStreamEvent;

interface TextStreamEvent {
    type: 'text';
    content: string;
}

interface ToolUseStreamEvent {
    type: 'tool_use';
    toolUseId: string;
    toolName: string;
    input: Record<string, unknown>;
}

interface ToolResultStreamEvent {
    type: 'tool_result';
    toolUseId: string;
    toolName: string;
    output: string;
}

interface CompleteStreamEvent {
    type: 'complete';
}

interface ErrorStreamEvent {
    type: 'error';
    error: string;
}

export type StreamCallback = (event: StreamEvent) => void;

interface QueryState {
    sessionId: string | null;
    fullContent: string;
    toolUseInfo: ToolUseInfo | null;
    activeTools: Map<string, { toolName: string; input: Record<string, unknown> }>;
}

function createQueryState(): QueryState {
    return {
        sessionId: null,
        fullContent: '',
        toolUseInfo: null,
        activeTools: new Map(),
    };
}

function handleSystemInitMessage(msg: Record<string, unknown>, state: QueryState): void {
    if (msg.type !== 'system' || msg.subtype !== 'init' || !('session_id' in msg)) {
        return;
    }
    state.sessionId = msg.session_id as string;
}

function handleAssistantMessage(
    msg: Record<string, unknown>,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (msg.type !== 'assistant' || !('message' in msg)) {
        return;
    }

    const assistantMsg = msg.message as { content?: unknown[] };
    if (!assistantMsg.content) return;

    for (const block of assistantMsg.content) {
        const contentBlock = block as Record<string, unknown>;

        if ('text' in contentBlock && contentBlock.text) {
            const text = String(contentBlock.text);
            state.fullContent += text;
            onStream({type: 'text', content: text});
            continue;
        }

        if ('type' in contentBlock && contentBlock.type === 'tool_use') {
            const toolBlock = contentBlock as {
                id: string;
                name: string;
                input: Record<string, unknown>;
            };

            state.activeTools.set(toolBlock.id, {
                toolName: toolBlock.name,
                input: toolBlock.input,
            });

            state.toolUseInfo = {
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

function handleUserMessage(
    msg: Record<string, unknown>,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (msg.type !== 'user' || !('message' in msg)) {
        return;
    }

    const userMsg = msg.message as { content?: unknown[] };
    if (!userMsg.content) return;

    for (const block of userMsg.content) {
        const contentBlock = block as Record<string, unknown>;

        if (contentBlock.type === 'tool_result' && 'tool_use_id' in contentBlock) {
            const toolUseId = String(contentBlock.tool_use_id);
            const content = String(contentBlock.content || '');
            const toolInfo = state.activeTools.get(toolUseId);

            if (!toolInfo) continue;

            if (state.toolUseInfo?.toolUseId === toolUseId) {
                state.toolUseInfo.output = content;
            }

            onStream({
                type: 'tool_result',
                toolUseId,
                toolName: toolInfo.toolName,
                output: content,
            });
        }
    }
}

function handleToolProgressMessage(
    msg: Record<string, unknown>,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (msg.type !== 'tool_progress') {
        return;
    }

    const toolProgressMsg = msg as {
        output?: string;
        result?: string;
        tool_use_id?: string;
    };

    const outputText = toolProgressMsg.output || toolProgressMsg.result;
    if (!outputText) return;

    const toolUseId = toolProgressMsg.tool_use_id;
    const toolInfo = toolUseId ? state.activeTools.get(toolUseId) : null;

    if (toolInfo && toolUseId) {
        if (state.toolUseInfo?.toolUseId === toolUseId) {
            state.toolUseInfo.output = outputText;
        }

        onStream({
            type: 'tool_result',
            toolUseId,
            toolName: toolInfo.toolName,
            output: outputText,
        });
        return;
    }

    if (state.toolUseInfo) {
        state.toolUseInfo.output = outputText;

        onStream({
            type: 'tool_result',
            toolUseId: state.toolUseInfo.toolUseId,
            toolName: state.toolUseInfo.toolName,
            output: outputText,
        });
    }
}

function handleResultMessage(
    msg: Record<string, unknown>,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (msg.type !== 'result') {
        return;
    }

    if (msg.subtype === 'success') {
        if (!state.fullContent && 'result' in msg && msg.result) {
            state.fullContent = String(msg.result);
        }

        onStream({type: 'complete'});
        return;
    }

    const errorMessage =
        'errors' in msg && Array.isArray(msg.errors)
            ? msg.errors.join(', ')
            : 'Unknown error';

    onStream({type: 'error', error: errorMessage});
    throw new Error(errorMessage);
}

class ClaudeQueryService {
    private activeQueries = new Map<string, {
        queryStream: Query;
        abortController: AbortController;
        connectionId: string;
    }>();

    public abortQuery(podId: string): boolean {
        const entry = this.activeQueries.get(podId);
        if (!entry) {
            return false;
        }

        // 只呼叫 abort()，不呼叫 close()
        // close() 會直接殺掉底層 CLI 進程，導致 for await 靜默結束而非拋出 AbortError
        // 這會使 catch 區塊無法被觸發，前端收不到 POD_CHAT_ABORTED 事件
        entry.abortController.abort();
        this.activeQueries.delete(podId);

        return true;
    }

    public getQueryConnectionId(podId: string): string | undefined {
        return this.activeQueries.get(podId)?.connectionId;
    }

    private buildPrompt(
        message: string | ContentBlock[],
        commandId: string | null,
        resumeSessionId: string | null
    ): string | AsyncIterable<SDKUserMessage> {
        if (typeof message === 'string') {
            let prompt = commandId ? `/${commandId} ${message}` : message;
            if (prompt.trim().length === 0) {
                prompt = '請開始執行';
            }
            return prompt;
        }

        const contentArray = buildClaudeContentBlocks(message, commandId);
        const sessionId = resumeSessionId || '';
        return createUserMessageStream(contentArray, sessionId);
    }

    private processSDKMessage(
        sdkMessage: unknown,
        state: QueryState,
        onStream: StreamCallback
    ): void {
        const msg = sdkMessage as Record<string, unknown>;

        handleSystemInitMessage(msg, state);
        handleAssistantMessage(msg, state, onStream);
        handleUserMessage(msg, state, onStream);
        handleToolProgressMessage(msg, state, onStream);
        handleResultMessage(msg, state, onStream);
    }

    async sendMessage(
        podId: string,
        message: string | ContentBlock[],
        onStream: StreamCallback,
        connectionId: string
    ): Promise<Message> {
        return this.sendMessageInternal(podId, message, onStream, connectionId, false);
    }

    private async sendMessageInternal(
        podId: string,
        message: string | ContentBlock[],
        onStream: StreamCallback,
        connectionId: string,
        isRetry: boolean
    ): Promise<Message> {
        const result = podStore.getByIdGlobal(podId);
        if (!result) {
            throw new Error(`找不到 Pod ${podId}`);
        }

        const {canvasId, pod} = result;
        const messageId = uuidv4();
        const state = createQueryState();

        try {
            const resumeSessionId = pod.claudeSessionId;
            const cwd = pod.repositoryId
                ? path.join(config.repositoriesRoot, pod.repositoryId)
                : pod.workspacePath;

            const abortController = new AbortController();

            const queryOptions: Options = {
                cwd,
                settingSources: ['project'],
                allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
                permissionMode: 'acceptEdits',
                includePartialMessages: true,
                abortController,
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

            this.activeQueries.set(podId, {queryStream, abortController, connectionId});

            for await (const sdkMessage of queryStream) {
                this.processSDKMessage(sdkMessage, state, onStream);
            }

            // 防禦性檢查：若 abort signal 已觸發但未拋出 AbortError，手動拋出
            // 這是為了處理 for await 迴圈靜默結束的邊緣情況
            if (abortController.signal.aborted) {
                const abortError = new Error('查詢已被中斷');
                abortError.name = 'AbortError';
                throw abortError;
            }

            if (state.sessionId && state.sessionId !== pod.claudeSessionId) {
                podStore.setClaudeSessionId(canvasId, podId, state.sessionId);
            }

            return {
                id: messageId,
                podId,
                role: 'assistant',
                content: state.fullContent,
                toolUse: state.toolUseInfo,
                createdAt: new Date(),
            };
        } catch (error) {
            const isAbortError = error instanceof AbortError || (error instanceof Error && error.name === 'AbortError');

            if (isAbortError) {
                // re-throw 讓外層 catch 處理，確保前端收到 POD_CHAT_ABORTED 事件
                throw error;
            }

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

            if (isRetry) {
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

            podStore.setClaudeSessionId(canvasId, podId, '');

            return this.sendMessageInternal(podId, message, onStream, connectionId, true);
        } finally {
            // 確保所有情況都清理 activeQueries entry，防止 Memory Leak
            this.activeQueries.delete(podId);
        }
    }
}

export const claudeQueryService = new ClaudeQueryService();
