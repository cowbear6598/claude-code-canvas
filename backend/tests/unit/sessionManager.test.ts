let mockQueryInstance: object;

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => {
    const original = await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>();
    return {
        ...original,
        query: vi.fn(() => {
            mockQueryInstance = {};
            return mockQueryInstance;
        }),
    };
});

vi.mock('../../src/services/claude/claudePathResolver.js', () => ({
    getClaudeCodePath: vi.fn(() => '/usr/local/bin/claude'),
}));

import * as claudeAgentSdk from '@anthropic-ai/claude-agent-sdk';

describe('ClaudeSessionManager', () => {
    let claudeSessionManager: typeof import('../../src/services/claude/sessionManager.js').claudeSessionManager;

    beforeEach(async () => {
        vi.resetModules();

        const module = await import('../../src/services/claude/sessionManager.js');
        claudeSessionManager = module.claudeSessionManager;

        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockClear();
        (claudeAgentSdk.query as ReturnType<typeof vi.fn>).mockImplementation(() => {
            mockQueryInstance = {};
            return mockQueryInstance;
        });
    });

    describe('createSession', () => {
        it('首次呼叫應建立並回傳 Query session', async () => {
            const session = await claudeSessionManager.createSession('pod-1', '/workspace');

            expect(claudeAgentSdk.query).toHaveBeenCalledTimes(1);
            expect(claudeAgentSdk.query).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: '',
                    options: expect.objectContaining({
                        cwd: '/workspace',
                    }),
                })
            );
            expect(session).toBe(mockQueryInstance);
        });

        it('相同 podId 第二次呼叫應回傳同一個 session（快取）', async () => {
            const session1 = await claudeSessionManager.createSession('pod-2', '/workspace');
            const session2 = await claudeSessionManager.createSession('pod-2', '/workspace');

            expect(claudeAgentSdk.query).toHaveBeenCalledTimes(1);
            expect(session1).toBe(session2);
        });
    });

    describe('destroySession', () => {
        it('destroySession 後再 createSession 同一 podId 應建立新的 session', async () => {
            const session1 = await claudeSessionManager.createSession('pod-3', '/workspace');
            await claudeSessionManager.destroySession('pod-3');
            const session2 = await claudeSessionManager.createSession('pod-3', '/workspace');

            expect(claudeAgentSdk.query).toHaveBeenCalledTimes(2);
            expect(session1).not.toBe(session2);
        });

        it('destroySession 不存在的 podId 不應拋錯', async () => {
            await expect(
                claudeSessionManager.destroySession('non-existent-pod')
            ).resolves.toBeUndefined();
        });
    });
});
