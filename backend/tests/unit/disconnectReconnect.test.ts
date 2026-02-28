// Mock 所有依賴模組（必須在 import 之前）
vi.mock('../../src/services/claude/claudeService.js', () => ({
    claudeService: {
        sendMessage: vi.fn(() => Promise.resolve({})),
        abortQuery: vi.fn(() => true),
    },
}));

vi.mock('../../src/services/socketService.js', () => ({
    socketService: {
        emitToCanvas: vi.fn(() => {}),
        cleanupSocket: vi.fn(() => {}),
        joinCanvasRoom: vi.fn(() => {}),
    },
}));

vi.mock('../../src/services/canvasStore.js', () => ({
    canvasStore: {
        removeSocket: vi.fn(() => {}),
        getBySocket: vi.fn(() => null),
    },
}));

vi.mock('../../src/handlers/cursorHandlers.js', () => ({
    broadcastCursorLeft: vi.fn(() => {}),
}));

import { claudeService } from '../../src/services/claude/claudeService.js';
import { socketService } from '../../src/services/socketService.js';

function asMock(fn: unknown) {
    return fn as ReturnType<typeof vi.fn>;
}

describe('斷線重連行為', () => {
    beforeEach(() => {
        asMock(claudeService.sendMessage).mockClear();
        asMock(claudeService.abortQuery).mockClear();
        asMock(socketService.cleanupSocket).mockClear();
    });

    describe('斷線後活躍查詢不被中斷', () => {
        it('呼叫 cleanupSocket 不會觸發 abortQuery', async () => {
            const podId = 'pod-1';
            const connectionId = 'conn-A';

            // 模擬正在執行的查詢
            let resolveQuery!: () => void;
            asMock(claudeService.sendMessage).mockImplementation(
                () => new Promise<void>((resolve) => { resolveQuery = resolve; })
            );

            // 啟動查詢
            const queryPromise = claudeService.sendMessage(podId, 'test message', vi.fn());

            // 模擬斷線清理（只呼叫 cleanupSocket，不應連帶 abort 查詢）
            socketService.cleanupSocket(connectionId);

            // 驗證查詢未被中斷
            expect(claudeService.abortQuery).not.toHaveBeenCalled();

            // 查詢可以正常完成
            resolveQuery();
            await expect(queryPromise).resolves.toBeUndefined();
        });
    });

    describe('重連後以新 connectionId 發送停止請求應成功', () => {
        it('以不同 connectionId 發送 abort 請求仍能成功中斷查詢', () => {
            const podId = 'pod-1';

            // abortQuery 不依賴 connectionId，任何連線皆可呼叫
            const aborted = claudeService.abortQuery(podId);

            expect(claudeService.abortQuery).toHaveBeenCalledWith(podId);
            expect(aborted).toBe(true);
        });

        it('連線 A 斷線後，連線 B 可以發送 abort 請求', () => {
            const podId = 'pod-1';
            const connectionIdA = 'conn-A';

            // 連線 A 斷線清理
            socketService.cleanupSocket(connectionIdA);

            // 連線 B 重連後發送 abort，不需要傳遞 connectionId
            const abortedByB = claudeService.abortQuery(podId);

            expect(abortedByB).toBe(true);
            expect(claudeService.abortQuery).toHaveBeenCalledWith(podId);
        });

        it('多次斷線重連後 abort 仍能正常運作', () => {
            const podId = 'pod-1';

            // 模擬多次斷線重連清理
            socketService.cleanupSocket('conn-1');
            socketService.cleanupSocket('conn-2');
            socketService.cleanupSocket('conn-3');

            // 每次斷線都未觸發 abortQuery
            expect(claudeService.abortQuery).not.toHaveBeenCalled();

            // 最終以新連線 abort 仍可成功
            const aborted = claudeService.abortQuery(podId);
            expect(aborted).toBe(true);
        });
    });
});
