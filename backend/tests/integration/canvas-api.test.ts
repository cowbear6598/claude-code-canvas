import {
	createTestServer,
	closeTestServer,
	createSocketClient,
	disconnectSocket,
	type TestServerInstance,
} from '../setup';
import { createCanvas } from '../helpers';
import type { TestWebSocketClient } from '../setup';

describe('Canvas REST API', () => {
	let server: TestServerInstance;
	let client: TestWebSocketClient;

	beforeAll(async () => {
		server = await createTestServer();
		client = await createSocketClient(server.baseUrl, server.canvasId);
	});

	afterAll(async () => {
		if (client?.connected) await disconnectSocket(client);
		if (server) await closeTestServer(server);
	});

	describe('GET /api/canvas/list', () => {
		it('成功取得畫布列表', async () => {
			const response = await fetch(`${server.baseUrl}/api/canvas/list`);

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('application/json');

			const body = await response.json();
			expect(Array.isArray(body.canvases)).toBe(true);
		});

		it('回傳資料包含正確欄位', async () => {
			const response = await fetch(`${server.baseUrl}/api/canvas/list`);
			const body = await response.json();

			expect(body.canvases.length).toBeGreaterThan(0);

			const canvas = body.canvases[0];
			expect(typeof canvas.id).toBe('string');
			expect(typeof canvas.name).toBe('string');
			expect(typeof canvas.createdAt).toBe('string');
			expect(typeof canvas.sortIndex).toBe('number');

			// 驗證 createdAt 為有效的 ISO 8601 字串
			expect(() => new Date(canvas.createdAt)).not.toThrow();
			expect(new Date(canvas.createdAt).toISOString()).toBe(canvas.createdAt);
		});

		it('回傳資料按 sortIndex 排序', async () => {
			await createCanvas(client, 'Api Test Canvas A');
			await createCanvas(client, 'Api Test Canvas B');

			const response = await fetch(`${server.baseUrl}/api/canvas/list`);
			const body = await response.json();

			const sortIndexes: number[] = body.canvases.map((c: { sortIndex: number }) => c.sortIndex);
			for (let i = 1; i < sortIndexes.length; i++) {
				expect(sortIndexes[i]).toBeGreaterThanOrEqual(sortIndexes[i - 1]);
			}
		});
	});

	describe('錯誤處理', () => {
		it('呼叫錯誤路徑回傳 404', async () => {
			const response = await fetch(`${server.baseUrl}/api/canvas`);

			expect(response.status).toBe(404);
			expect(response.headers.get('content-type')).toBe('application/json');

			const body = await response.json();
			expect(body.error).toBe('找不到 API 路徑');
		});

		it('呼叫錯誤 HTTP method 回傳 404', async () => {
			const response = await fetch(`${server.baseUrl}/api/canvas/list`, {
				method: 'POST',
			});

			expect(response.status).toBe(404);
			expect(response.headers.get('content-type')).toBe('application/json');

			const body = await response.json();
			expect(body.error).toBe('找不到 API 路徑');
		});

		it('handler 拋出例外時回傳 500', async () => {
			const { canvasStore } = await import('../../src/services/canvasStore.js');
			vi.spyOn(canvasStore, 'list').mockImplementationOnce(() => {
				throw new Error('模擬資料庫錯誤');
			});

			const response = await fetch(`${server.baseUrl}/api/canvas/list`);

			expect(response.status).toBe(500);
			expect(response.headers.get('content-type')).toBe('application/json');

			const body = await response.json();
			expect(body.error).toBe('伺服器內部錯誤');

			vi.restoreAllMocks();
		});
	});

	describe('空列表情境', () => {
		it('沒有畫布時回傳空陣列', async () => {
			const { canvasStore } = await import('../../src/services/canvasStore.js');
			vi.spyOn(canvasStore, 'list').mockReturnValueOnce([]);

			const response = await fetch(`${server.baseUrl}/api/canvas/list`);

			expect(response.status).toBe(200);

			const body = await response.json();
			expect(body.canvases).toEqual([]);

			vi.restoreAllMocks();
		});
	});
});
