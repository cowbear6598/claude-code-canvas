import {describe, it, expect, beforeEach, mock, type Mock} from 'bun:test';

// Mock 所有依賴模組（必須在 import 之前）
mock.module('../../src/services/claude/queryService.js', () => ({
    claudeQueryService: {
        sendMessage: mock(() => Promise.resolve({})),
    },
}));

mock.module('../../src/services/socketService.js', () => ({
    socketService: {
        emitToCanvas: mock(() => {}),
    },
}));

mock.module('../../src/services/messageStore.js', () => ({
    messageStore: {
        upsertMessage: mock(() => {}),
        flushWrites: mock(() => Promise.resolve()),
    },
}));

mock.module('../../src/services/podStore.js', () => ({
    podStore: {
        setStatus: mock(() => {}),
        updateLastActive: mock(() => {}),
    },
}));

mock.module('../../src/utils/logger.js', () => ({
    logger: {
        log: mock(() => {}),
        error: mock(() => {}),
    },
}));

// 現在可以 import 被測試的模組
import {executeStreamingChat} from '../../src/services/claude/streamingChatExecutor.js';
import {claudeQueryService} from '../../src/services/claude/queryService.js';
import {socketService} from '../../src/services/socketService.js';
import {messageStore} from '../../src/services/messageStore.js';
import {podStore} from '../../src/services/podStore.js';
import {logger} from '../../src/utils/logger.js';
import {WebSocketResponseEvents} from '../../src/schemas';
import {AbortError} from '@anthropic-ai/claude-agent-sdk';

/** 取得 mock 函式的型別化引用，避免重複的 `as Mock<any>` 轉型 */
function asMock(fn: unknown): Mock<any> {
    return fn as Mock<any>;
}

describe('executeStreamingChat', () => {
    const canvasId = 'test-canvas';
    const podId = 'test-pod';
    const message = 'test message';
    const connectionId = 'test-connection';

    // Helper: 設定 sendMessage mock 來產生特定事件序列
    function mockSendMessageWithEvents(events: Array<{type: string; [key: string]: unknown}>) {
        asMock(claudeQueryService.sendMessage).mockImplementation(
            async (_podId: string, _message: unknown, callback: (event: any) => void, _connectionId: string) => {
                for (const event of events) {
                    callback(event);
                }
                return {};
            }
        );
    }

    // Helper: 設定 sendMessage mock 拋出 AbortError
    function mockSendMessageWithAbort(eventsBeforeAbort: Array<{type: string; [key: string]: unknown}> = []) {
        asMock(claudeQueryService.sendMessage).mockImplementation(
            async (_podId: string, _message: unknown, callback: (event: any) => void, _connectionId: string) => {
                for (const event of eventsBeforeAbort) {
                    callback(event);
                }
                const error = new Error('查詢已被中斷');
                error.name = 'AbortError';
                throw error;
            }
        );
    }

    // Helper: 設定 sendMessage mock 拋出一般錯誤
    function mockSendMessageWithError(error: Error) {
        asMock(claudeQueryService.sendMessage).mockImplementation(
            async () => {
                throw error;
            }
        );
    }

    beforeEach(() => {
        // 重置所有 mock
        asMock(claudeQueryService.sendMessage).mockClear();
        asMock(socketService.emitToCanvas).mockClear();
        asMock(messageStore.upsertMessage).mockClear();
        asMock(messageStore.flushWrites).mockClear();
        asMock(podStore.setStatus).mockClear();
        asMock(podStore.updateLastActive).mockClear();
        asMock(logger.log).mockClear();
        asMock(logger.error).mockClear();

        // 預設 mock 行為
        asMock(claudeQueryService.sendMessage).mockImplementation(() => Promise.resolve({}));
        asMock(messageStore.flushWrites).mockImplementation(() => Promise.resolve());
    });

    describe('streaming event 處理', () => {
        it('text event 正確累積內容並廣播 POD_CLAUDE_CHAT_MESSAGE', async () => {
            mockSendMessageWithEvents([
                {type: 'text', content: 'Hello'},
                {type: 'text', content: ' World'},
                {type: 'complete'},
            ]);

            const result = await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 emitToCanvas 被呼叫兩次（兩個 text event）
            expect(socketService.emitToCanvas).toHaveBeenCalledTimes(3); // 2 text + 1 complete

            // 驗證第一個 text event
            expect(socketService.emitToCanvas).toHaveBeenNthCalledWith(
                1,
                canvasId,
                WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
                expect.objectContaining({
                    canvasId,
                    podId,
                    messageId: expect.any(String),
                    content: 'Hello',
                    isPartial: true,
                    role: 'assistant',
                })
            );

            // 驗證第二個 text event
            expect(socketService.emitToCanvas).toHaveBeenNthCalledWith(
                2,
                canvasId,
                WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
                expect.objectContaining({
                    canvasId,
                    podId,
                    messageId: expect.any(String),
                    content: 'Hello World',
                    isPartial: true,
                    role: 'assistant',
                })
            );

            // 驗證 result
            expect(result.content).toBe('Hello World');
            expect(result.hasContent).toBe(true);
            expect(result.aborted).toBe(false);
        });

        it('tool_use event 正確處理並廣播 POD_CHAT_TOOL_USE', async () => {
            mockSendMessageWithEvents([
                {type: 'tool_use', toolUseId: 'tu1', toolName: 'Read', input: {path: '/test'}},
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 tool_use event
            expect(socketService.emitToCanvas).toHaveBeenCalledWith(
                canvasId,
                WebSocketResponseEvents.POD_CHAT_TOOL_USE,
                expect.objectContaining({
                    canvasId,
                    podId,
                    messageId: expect.any(String),
                    toolUseId: 'tu1',
                    toolName: 'Read',
                    input: {path: '/test'},
                })
            );
        });

        it('tool_result event 正確處理並廣播 POD_CHAT_TOOL_RESULT', async () => {
            mockSendMessageWithEvents([
                {type: 'tool_use', toolUseId: 'tu1', toolName: 'Read', input: {path: '/test'}},
                {type: 'tool_result', toolUseId: 'tu1', toolName: 'Read', output: 'file content'},
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 tool_result event
            expect(socketService.emitToCanvas).toHaveBeenCalledWith(
                canvasId,
                WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
                expect.objectContaining({
                    canvasId,
                    podId,
                    messageId: expect.any(String),
                    toolUseId: 'tu1',
                    toolName: 'Read',
                    output: 'file content',
                })
            );
        });

        it('complete event 觸發 flush 並廣播 POD_CHAT_COMPLETE', async () => {
            mockSendMessageWithEvents([
                {type: 'text', content: 'Hello'},
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 complete event
            expect(socketService.emitToCanvas).toHaveBeenCalledWith(
                canvasId,
                WebSocketResponseEvents.POD_CHAT_COMPLETE,
                expect.objectContaining({
                    canvasId,
                    podId,
                    messageId: expect.any(String),
                    fullContent: 'Hello',
                })
            );
        });

        it('每個 streaming event 都呼叫 persistStreamingMessage（upsert）', async () => {
            mockSendMessageWithEvents([
                {type: 'text', content: 'Hello'},
                {type: 'tool_use', toolUseId: 'tu1', toolName: 'Read', input: {path: '/test'}},
                {type: 'tool_result', toolUseId: 'tu1', toolName: 'Read', output: 'file content'},
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 upsertMessage 被呼叫 4 次
            // 3 次 streaming 中（text, tool_use, tool_result）+ 1 次完成後最終 persist
            expect(messageStore.upsertMessage).toHaveBeenCalledTimes(4);
        });

        it('error event 記錄 logger 但不中斷', async () => {
            mockSendMessageWithEvents([
                {type: 'error', error: '測試錯誤'},
                {type: 'text', content: 'Hello'},
                {type: 'complete'},
            ]);

            const result = await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 logger.error 被呼叫
            expect(logger.error).toHaveBeenCalledWith(
                'Chat',
                'Error',
                'Pod test-pod streaming 過程發生錯誤'
            );

            // 驗證函式正常完成（不 throw）
            expect(result.hasContent).toBe(true);
            expect(result.content).toBe('Hello');
        });
    });

    describe('成功完成', () => {
        it('完成後正確呼叫 flushWrites + setStatus idle + updateLastActive', async () => {
            mockSendMessageWithEvents([
                {type: 'text', content: 'Hello'},
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 upsertMessage 被呼叫（streaming 中 + 最終）
            expect(messageStore.upsertMessage).toHaveBeenCalled();

            // 驗證 flushWrites 被呼叫
            expect(messageStore.flushWrites).toHaveBeenCalledWith(podId);

            // 驗證 setStatus idle 被呼叫
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, podId, 'idle');

            // 驗證 updateLastActive 被呼叫
            expect(podStore.updateLastActive).toHaveBeenCalledWith(canvasId, podId);
        });

        it('完成後正確呼叫 onComplete callback', async () => {
            mockSendMessageWithEvents([
                {type: 'text', content: 'Hello'},
                {type: 'complete'},
            ]);

            const onComplete = mock(() => {});

            await executeStreamingChat(
                {
                    canvasId,
                    podId,
                    message,
                    connectionId,
                    supportAbort: false,
                },
                {
                    onComplete,
                }
            );

            // 驗證 onComplete 被呼叫
            expect(onComplete).toHaveBeenCalledWith(canvasId, podId);
        });

        it('無 assistant content 時不呼叫 persist 和 flushWrites', async () => {
            mockSendMessageWithEvents([
                {type: 'complete'},
            ]);

            await executeStreamingChat({
                canvasId,
                podId,
                message,
                connectionId,
                supportAbort: false,
            });

            // 驗證 upsertMessage 未被呼叫
            expect(messageStore.upsertMessage).not.toHaveBeenCalled();

            // 驗證 flushWrites 未被呼叫
            expect(messageStore.flushWrites).not.toHaveBeenCalled();

            // 驗證 setStatus idle 仍被呼叫
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, podId, 'idle');

            // 驗證 updateLastActive 仍被呼叫
            expect(podStore.updateLastActive).toHaveBeenCalledWith(canvasId, podId);
        });
    });

    describe('AbortError 處理', () => {
        it('AbortError + supportAbort=true 時正確處理', async () => {
            mockSendMessageWithAbort([
                {type: 'text', content: 'Hello'},
            ]);

            const onAborted = mock(() => {});

            const result = await executeStreamingChat(
                {
                    canvasId,
                    podId,
                    message,
                    connectionId,
                    supportAbort: true,
                },
                {
                    onAborted,
                }
            );

            // 驗證函式不 throw
            expect(result.aborted).toBe(true);
            expect(result.content).toBe('Hello');

            // 驗證 setStatus idle 被呼叫
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, podId, 'idle');

            // 驗證 upsertMessage 被呼叫（persist 中斷時的內容）
            expect(messageStore.upsertMessage).toHaveBeenCalled();

            // 驗證 flushWrites 被呼叫
            expect(messageStore.flushWrites).toHaveBeenCalledWith(podId);

            // 驗證 onAborted 被呼叫
            expect(onAborted).toHaveBeenCalledWith(canvasId, podId, expect.any(String));

            // 驗證 updateLastActive 未被呼叫（中斷時不更新）
            expect(podStore.updateLastActive).not.toHaveBeenCalled();
        });

        it('AbortError + supportAbort=false 時 re-throw', async () => {
            mockSendMessageWithAbort();

            const onAborted = mock(() => {});

            // 驗證函式 throw AbortError
            await expect(
                executeStreamingChat(
                    {
                        canvasId,
                        podId,
                        message,
                        connectionId,
                        supportAbort: false,
                    },
                    {
                        onAborted,
                    }
                )
            ).rejects.toThrow('查詢已被中斷');

            // 驗證 setStatus idle 被呼叫
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, podId, 'idle');

            // 驗證 onAborted 未被呼叫
            expect(onAborted).not.toHaveBeenCalled();
        });

        it('SDK AbortError 實例也正確處理', async () => {
            // 使用真正的 AbortError 類別
            asMock(claudeQueryService.sendMessage).mockImplementation(
                async (_podId: string, _message: unknown, callback: (event: any) => void, _connectionId: string) => {
                    callback({type: 'text', content: 'Hello'});
                    throw new AbortError('SDK abort');
                }
            );

            const onAborted = mock(() => {});

            const result = await executeStreamingChat(
                {
                    canvasId,
                    podId,
                    message,
                    connectionId,
                    supportAbort: true,
                },
                {
                    onAborted,
                }
            );

            // 驗證函式正確處理 SDK AbortError
            expect(result.aborted).toBe(true);
            expect(onAborted).toHaveBeenCalled();
        });
    });

    describe('一般錯誤處理', () => {
        it('一般錯誤時呼叫 onError callback 並 re-throw', async () => {
            const testError = new Error('Claude API 錯誤');
            mockSendMessageWithError(testError);

            const onError = mock(() => {});

            // 驗證函式 throw Error
            await expect(
                executeStreamingChat(
                    {
                        canvasId,
                        podId,
                        message,
                        connectionId,
                        supportAbort: false,
                    },
                    {
                        onError,
                    }
                )
            ).rejects.toThrow('Claude API 錯誤');

            // 驗證 setStatus idle 被呼叫
            expect(podStore.setStatus).toHaveBeenCalledWith(canvasId, podId, 'idle');

            // 驗證 onError 被呼叫
            expect(onError).toHaveBeenCalledWith(
                canvasId,
                podId,
                expect.objectContaining({message: 'Claude API 錯誤'})
            );
        });
    });
});
