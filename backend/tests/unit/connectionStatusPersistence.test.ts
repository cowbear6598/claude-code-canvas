import { mkdir, rm, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectionStore } from '../../src/services/connectionStore.js';
import { canvasStore } from '../../src/services/canvasStore.js';
import type { ConnectionStatus } from '../../src/types/connection.js';

// 相容 Node.js 和 Bun：import.meta.dir 是 Bun 專屬，Node.js 需要用 fileURLToPath
const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));

const ALL_CONNECTION_STATUSES: ConnectionStatus[] = [
    'idle',
    'active',
    'queued',
    'waiting',
    'ai-deciding',
    'ai-approved',
    'ai-rejected',
    'ai-error',
];

describe('ConnectionStatus 持久化', () => {
    let tempDir: string;
    const canvasId = 'test-canvas-persist';
    let getCanvasDataDirSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        tempDir = join(__dirname, `temp-connection-status-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });

        getCanvasDataDirSpy = vi.spyOn(canvasStore, 'getCanvasDataDir').mockReturnValue(tempDir);

        // 清除記憶體狀態，確保測試間互不影響
        await connectionStore.loadFromDisk(canvasId, tempDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('saveToDisk', () => {
        it('將 connectionStatus 寫入磁碟', async () => {
            const connection = connectionStore.create(canvasId, {
                sourcePodId: 'pod-a',
                sourceAnchor: 'right',
                targetPodId: 'pod-b',
                targetAnchor: 'left',
            });

            connectionStore.updateConnectionStatus(canvasId, connection.id, 'active');

            await connectionStore.saveToDisk(canvasId);

            const raw = await readFile(join(tempDir, 'connections.json'), 'utf-8');
            const persisted = JSON.parse(raw) as Array<Record<string, unknown>>;

            expect(persisted).toHaveLength(1);
            expect(persisted[0].connectionStatus).toBe('active');
        });
    });

    describe('loadFromDisk', () => {
        it('正確還原 connectionStatus', async () => {
            const connection = connectionStore.create(canvasId, {
                sourcePodId: 'pod-a',
                sourceAnchor: 'right',
                targetPodId: 'pod-b',
                targetAnchor: 'left',
            });

            connectionStore.updateConnectionStatus(canvasId, connection.id, 'queued');
            await connectionStore.saveToDisk(canvasId);

            // 重新載入
            const result = await connectionStore.loadFromDisk(canvasId, tempDir);
            expect(result.success).toBe(true);

            const loaded = connectionStore.getById(canvasId, connection.id);
            expect(loaded?.connectionStatus).toBe('queued');
        });

        it('舊資料無 connectionStatus 時 fallback 為 idle', async () => {
            const legacyData = [
                {
                    id: 'legacy-conn-1',
                    sourcePodId: 'pod-a',
                    sourceAnchor: 'right',
                    targetPodId: 'pod-b',
                    targetAnchor: 'left',
                    triggerMode: 'auto',
                    decideStatus: 'none',
                    decideReason: null,
                    // 刻意不包含 connectionStatus 欄位
                },
            ];

            const { writeFile } = await import('fs/promises');
            await writeFile(
                join(tempDir, 'connections.json'),
                JSON.stringify(legacyData),
                'utf-8',
            );

            const result = await connectionStore.loadFromDisk(canvasId, tempDir);
            expect(result.success).toBe(true);

            const loaded = connectionStore.getById(canvasId, 'legacy-conn-1');
            expect(loaded?.connectionStatus).toBe('idle');
        });
    });

    describe('updateConnectionStatus', () => {
        it('呼叫後觸發磁碟寫入', async () => {
            const connection = connectionStore.create(canvasId, {
                sourcePodId: 'pod-a',
                sourceAnchor: 'right',
                targetPodId: 'pod-b',
                targetAnchor: 'left',
            });

            const saveSpy = vi.spyOn(connectionStore, 'saveToDisk');

            connectionStore.updateConnectionStatus(canvasId, connection.id, 'waiting');

            // saveToDiskAsync 是 fire-and-forget，等一個 microtask 讓其被排程
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(saveSpy).toHaveBeenCalledWith(canvasId);
        });
    });

    describe('所有 ConnectionStatus 值的序列化/反序列化一致性', () => {
        it.each(ALL_CONNECTION_STATUSES)('status "%s" 存入磁碟後可正確還原', async (status) => {
            const connection = connectionStore.create(canvasId, {
                sourcePodId: 'pod-a',
                sourceAnchor: 'right',
                targetPodId: 'pod-b',
                targetAnchor: 'left',
            });

            connectionStore.updateConnectionStatus(canvasId, connection.id, status);
            await connectionStore.saveToDisk(canvasId);

            const result = await connectionStore.loadFromDisk(canvasId, tempDir);
            expect(result.success).toBe(true);

            const loaded = connectionStore.getById(canvasId, connection.id);
            expect(loaded?.connectionStatus).toBe(status);
        });
    });
});
