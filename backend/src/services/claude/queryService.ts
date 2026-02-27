import {v4 as uuidv4} from 'uuid';
import path from 'path';
import {type Options, type Query, query} from '@anthropic-ai/claude-agent-sdk';
import type {SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKResultMessage, SDKUserMessage as SDKUserMessageType} from '@anthropic-ai/claude-agent-sdk';
import {podStore} from '../podStore.js';
import {isAbortError, getErrorMessage} from '../../utils/errorHelpers.js';
import {outputStyleService} from '../outputStyleService.js';
import {Message, ToolUseInfo, ContentBlock, Pod} from '../../types';
import {config} from '../../config';
import {logger} from '../../utils/logger.js';
import {
    buildClaudeContentBlocks,
    createUserMessageStream,
    type SDKUserMessage,
} from './messageBuilder.js';
import type {StreamCallback} from './types.js';

export type {StreamEvent, StreamCallback} from './types.js';

// SDK 的 SDKToolProgressMessage 不含 output/result 欄位，此為我們實際接收到的訊息結構
type SDKToolProgressWithOutput = {
    type: 'tool_progress';
    output?: string;
    result?: string;
    tool_use_id?: string;
};

type AssistantTextBlock = { type: 'text'; text: string };
type AssistantToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type AssistantContentBlock = AssistantTextBlock | AssistantToolUseBlock;

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

function handleSystemInitMessage(sdkMessage: SDKSystemMessage, state: QueryState): void {
    state.sessionId = sdkMessage.session_id;
}

function processTextBlock(
    contentBlock: AssistantTextBlock,
    state: QueryState,
    onStream: StreamCallback
): void {
    state.fullContent += contentBlock.text;
    onStream({type: 'text', content: contentBlock.text});
}

function processToolUseBlock(
    contentBlock: AssistantToolUseBlock,
    state: QueryState,
    onStream: StreamCallback
): void {
    state.activeTools.set(contentBlock.id, {
        toolName: contentBlock.name,
        input: contentBlock.input,
    });

    state.toolUseInfo = {
        toolUseId: contentBlock.id,
        toolName: contentBlock.name,
        input: contentBlock.input,
        output: null,
    };

    onStream({
        type: 'tool_use',
        toolUseId: contentBlock.id,
        toolName: contentBlock.name,
        input: contentBlock.input,
    });
}

function handleAssistantMessage(
    sdkMessage: SDKAssistantMessage,
    state: QueryState,
    onStream: StreamCallback
): void {
    const assistantMessage = sdkMessage.message;
    if (!assistantMessage.content) return;

    for (const block of assistantMessage.content as AssistantContentBlock[]) {
        if (block.type === 'text' && block.text) {
            processTextBlock(block, state, onStream);
            continue;
        }

        if (block.type === 'tool_use') {
            processToolUseBlock(block, state, onStream);
        }
    }
}

type UserToolResultBlock = {
    type: 'tool_result';
    tool_use_id: string;
    content?: string;
};

function isToolResultBlock(block: unknown): block is UserToolResultBlock {
    return (
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'tool_result' &&
        'tool_use_id' in (block as Record<string, unknown>)
    );
}

function handleToolResultBlock(
    block: unknown,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (!isToolResultBlock(block)) return;

    const toolUseId = block.tool_use_id;
    const content = block.content ?? '';
    const toolInfo = state.activeTools.get(toolUseId);

    if (!toolInfo) return;

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

function handleUserMessage(
    sdkMessage: SDKUserMessageType,
    state: QueryState,
    onStream: StreamCallback
): void {
    const userMessage = sdkMessage.message;
    if (!userMessage.content || !Array.isArray(userMessage.content)) return;

    for (const block of userMessage.content) {
        handleToolResultBlock(block, state, onStream);
    }
}

function updateExistingToolProgress(
    state: QueryState,
    toolUseId: string,
    outputText: string,
    onStream: StreamCallback
): void {
    const toolInfo = state.activeTools.get(toolUseId);
    if (!toolInfo) return;

    if (state.toolUseInfo?.toolUseId === toolUseId) {
        state.toolUseInfo.output = outputText;
    }

    onStream({
        type: 'tool_result',
        toolUseId,
        toolName: toolInfo.toolName,
        output: outputText,
    });
}

function createNewToolProgress(
    state: QueryState,
    outputText: string,
    onStream: StreamCallback
): void {
    if (!state.toolUseInfo) return;

    state.toolUseInfo.output = outputText;

    onStream({
        type: 'tool_result',
        toolUseId: state.toolUseInfo.toolUseId,
        toolName: state.toolUseInfo.toolName,
        output: outputText,
    });
}

function handleToolProgressMessage(
    sdkMessage: SDKToolProgressWithOutput,
    state: QueryState,
    onStream: StreamCallback
): void {
    const outputText = sdkMessage.output || sdkMessage.result;
    if (!outputText) return;

    const toolUseId = sdkMessage.tool_use_id;
    const hasKnownTool = toolUseId && state.activeTools.has(toolUseId);

    if (hasKnownTool && toolUseId) {
        updateExistingToolProgress(state, toolUseId, outputText, onStream);
        return;
    }

    createNewToolProgress(state, outputText, onStream);
}

function handleResultMessage(
    sdkMessage: SDKResultMessage,
    state: QueryState,
    onStream: StreamCallback
): void {
    if (sdkMessage.subtype === 'success') {
        if (!state.fullContent && sdkMessage.result) {
            state.fullContent = sdkMessage.result;
        }

        onStream({type: 'complete'});
        return;
    }

    const errorMessage = sdkMessage.errors.length > 0 ? sdkMessage.errors.join(', ') : 'Unknown error';

    onStream({type: 'error', error: '與 Claude 通訊時發生錯誤，請稍後再試'});
    throw new Error(errorMessage);
}

function shouldRetrySession(error: unknown, pod: Pod, isRetry: boolean): boolean {
    const errorMessage = getErrorMessage(error);
    const isResumeError = errorMessage.includes('session') || errorMessage.includes('resume');
    return isResumeError && !!pod.claudeSessionId && !isRetry;
}

interface HandleSendMessageErrorParams {
    error: unknown;
    pod: Pod;
    canvasId: string;
    podId: string;
    onStream: StreamCallback;
    isRetry: boolean;
    retryFn: () => Promise<Message>;
}

async function handleSendMessageError(params: HandleSendMessageErrorParams): Promise<Message> {
    const {error, pod, canvasId, podId, onStream, isRetry, retryFn} = params;

    if (isAbortError(error)) {
        // re-throw 讓外層 catch 處理，確保前端收到 POD_CHAT_ABORTED 事件
        throw error;
    }

    if (shouldRetrySession(error, pod, isRetry)) {
        logger.log(
            'Chat',
            'Update',
            `[QueryService] Session resume failed for Pod ${podId}, clearing session ID and retrying`
        );
        podStore.setClaudeSessionId(canvasId, podId, '');
        return retryFn();
    }

    const errorMessage = getErrorMessage(error);
    if (isRetry) {
        logger.error('Chat', 'Error', `Pod ${podId} 重試查詢仍然失敗: ${errorMessage}`);
    } else {
        logger.error('Chat', 'Error', `Pod ${podId} 查詢失敗: ${errorMessage}`);
    }

    // 對前端隱藏內部錯誤細節，只顯示通用訊息
    onStream({type: 'error', error: '與 Claude 通訊時發生錯誤，請稍後再試'});
    throw error;
}

const SDK_MESSAGE_HANDLERS: Record<string, (msg: SDKMessage, s: QueryState, cb: StreamCallback) => void> = {
    assistant: (msg, s, cb) => handleAssistantMessage(msg as SDKAssistantMessage, s, cb),
    user: (msg, s, cb) => handleUserMessage(msg as SDKUserMessageType, s, cb),
    tool_progress: (msg, s, cb) => handleToolProgressMessage(msg as unknown as SDKToolProgressWithOutput, s, cb),
    result: (msg, s, cb) => handleResultMessage(msg as SDKResultMessage, s, cb),
};

class ClaudeQueryService {
    private activeQueries = new Map<string, {
        queryStream: Query;
        abortController: AbortController;
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
        sdkMessage: SDKMessage,
        state: QueryState,
        onStream: StreamCallback
    ): void {
        if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
            handleSystemInitMessage(sdkMessage, state);
            return;
        }

        SDK_MESSAGE_HANDLERS[sdkMessage.type]?.(sdkMessage, state, onStream);
    }

    private async buildQueryOptions(
        pod: Pod,
        cwd: string
    ): Promise<Options & { abortController: AbortController }> {
        const abortController = new AbortController();

        const queryOptions: Options & { abortController: AbortController } = {
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

        if (pod.claudeSessionId) {
            queryOptions.resume = pod.claudeSessionId;
        }

        queryOptions.model = pod.model;

        return queryOptions;
    }

    async sendMessage(
        podId: string,
        message: string | ContentBlock[],
        onStream: StreamCallback
    ): Promise<Message> {
        return this.sendMessageInternal(podId, message, onStream, false);
    }

    private async sendMessageInternal(
        podId: string,
        message: string | ContentBlock[],
        onStream: StreamCallback,
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

            const queryOptions = await this.buildQueryOptions(pod, cwd);
            const {abortController} = queryOptions;

            const prompt = this.buildPrompt(message, pod.commandId, resumeSessionId);

            const queryStream = query({
                prompt,
                options: queryOptions,
            });

            this.activeQueries.set(podId, {queryStream, abortController});

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
            return handleSendMessageError({
                error,
                pod,
                canvasId,
                podId,
                onStream,
                isRetry,
                retryFn: () => this.sendMessageInternal(podId, message, onStream, true),
            });
        } finally {
            // 確保所有情況都清理 activeQueries entry，防止 Memory Leak
            this.activeQueries.delete(podId);
        }
    }
}

export const claudeQueryService = new ClaudeQueryService();
