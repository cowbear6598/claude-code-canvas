let mockQueryGenerator: () => AsyncGenerator<object>;

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => {
    const original = await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>();
    return {
        ...original,
        query: vi.fn(() => mockQueryGenerator()),
    };
});

vi.mock('../../src/services/claude/claudePathResolver.js', () => ({
    getClaudeCodePath: vi.fn(() => '/usr/local/bin/claude'),
}));

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { disposableChatService } from '../../src/services/claude/disposableChatService.js';

const defaultOptions = {
    systemPrompt: '你是一個助理',
    userMessage: '你好',
    workspacePath: '/workspace',
};

describe('DisposableChatService', () => {
    beforeEach(() => {
        mockQueryGenerator = async function* () {};
    });

    describe('executeDisposableChat', () => {
        it('成功執行一次性 Chat：應回傳 { success: true, content }', async () => {
            mockQueryGenerator = async function* () {
                yield {
                    type: 'assistant',
                    message: {
                        content: [{ type: 'text', text: '你好，我是助理！' }],
                    },
                };
                yield {
                    type: 'result',
                    subtype: 'success',
                    result: '你好，我是助理！',
                };
            };

            const result = await disposableChatService.executeDisposableChat(defaultOptions);

            expect(result.success).toBe(true);
            expect(result.content).toBe('你好，我是助理！');
            expect(result.error).toBeUndefined();
        });

        it('SDK 回傳 result:error 時應回傳 { success: false, error }', async () => {
            mockQueryGenerator = async function* () {
                yield {
                    type: 'result',
                    subtype: 'error',
                    errors: ['執行失敗', '權限不足'],
                };
            };

            const result = await disposableChatService.executeDisposableChat(defaultOptions);

            expect(result.success).toBe(false);
            expect(result.content).toBe('');
            expect(result.error).toBe('執行失敗, 權限不足');
        });

        it('SDK 拋出例外時應回傳 { success: false, error } 而不是讓例外往上傳', async () => {
            mockQueryGenerator = async function* () {
                throw new Error('網路連線失敗');
                yield {};
            };

            const result = await disposableChatService.executeDisposableChat(defaultOptions);

            expect(result.success).toBe(false);
            expect(result.content).toBe('');
            expect(result.error).toBe('網路連線失敗');
        });

        it('多個 assistant message 的文字應正確累加', async () => {
            mockQueryGenerator = async function* () {
                yield {
                    type: 'assistant',
                    message: {
                        content: [{ type: 'text', text: '第一段，' }],
                    },
                };
                yield {
                    type: 'assistant',
                    message: {
                        content: [{ type: 'text', text: '第二段，' }],
                    },
                };
                yield {
                    type: 'assistant',
                    message: {
                        content: [{ type: 'text', text: '第三段。' }],
                    },
                };
                yield {
                    type: 'result',
                    subtype: 'success',
                    result: '最終結果',
                };
            };

            const result = await disposableChatService.executeDisposableChat(defaultOptions);

            expect(result.success).toBe(true);
            // result:success 的 result 欄位會覆蓋累積的 fullContent
            expect(result.content).toBe('最終結果');
        });
    });
});
