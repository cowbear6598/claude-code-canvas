import {
	createTestServer,
	closeTestServer,
	createSocketClient,
	disconnectSocket,
	waitForEvent,
	type TestServerInstance,
} from '../setup';
import { createCanvas } from '../helpers';
import type { TestWebSocketClient } from '../setup';
import { canvasStore } from '../../src/services/canvasStore.js';

async function postCanvas(baseUrl: string, body: unknown, contentType = 'application/json') {
	return fetch(`${baseUrl}/api/canvas`, {
		method: 'POST',
		headers: { 'Content-Type': contentType },
		body: contentType === 'application/json' ? JSON.stringify(body) : String(body),
	});
}

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

	describe('POST /api/canvas', () => {
		it('成功建立 Canvas 並回傳 201 與正確欄位', async () => {
			const response = await postCanvas(server.baseUrl, { name: 'rest-api-test' });
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.canvas).toBeDefined();
			expect(body.canvas.id).toBeTypeOf('string');
			expect(body.canvas.name).toBe('rest-api-test');
			expect(body.canvas.sortIndex).toBeTypeOf('number');
			// 驗證 ISO 8601 格式
			expect(() => new Date(body.canvas.createdAt).toISOString()).not.toThrow();
		});

		it('成功建立後透過 WebSocket 廣播 canvas:created 事件', async () => {
			const eventPromise = waitForEvent(client, 'canvas:created', 5000);
			const response = await postCanvas(server.baseUrl, { name: 'ws-broadcast-test' });
			expect(response.status).toBe(201);
			const event = await eventPromise;
			expect(event.success).toBe(true);
			expect(event.canvas).toBeDefined();
			expect(event.canvas.name).toBe('ws-broadcast-test');
			expect(event.requestId).toBe('system');
		});

		it('缺少 name 欄位回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, {});
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱不能為空');
		});

		it('name 為空字串回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, { name: '   ' });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱不能為空');
		});

		it('name 包含非法字元回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, { name: 'test@canvas!' });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱只能包含英文字母、數字、底線、連字號和空格');
		});

		it('name 超過 50 字元回傳 400', async () => {
			const longName = 'a'.repeat(51);
			const response = await postCanvas(server.baseUrl, { name: longName });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱不能超過 50 個字元');
		});

		it('重複名稱回傳 400', async () => {
			await postCanvas(server.baseUrl, { name: 'duplicate-test' });
			const response = await postCanvas(server.baseUrl, { name: 'duplicate-test' });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('已存在相同名稱的 Canvas');
		});

		it('request body 非 JSON 格式回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, 'not json', 'text/plain');
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('無效的請求格式');
		});

		it('name 為 null 回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, { name: null });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱不能為空');
		});

		it('name 為非字串型別回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, { name: 123 });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱不能為空');
		});

		it('Windows 保留名稱回傳 400', async () => {
			const response = await postCanvas(server.baseUrl, { name: 'CON' });
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('Canvas 名稱為系統保留名稱');
		});

		it('name 剛好 50 字元應成功建立', async () => {
			const name50 = 'a'.repeat(50);
			const response = await postCanvas(server.baseUrl, { name: name50 });
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.canvas.name).toBe(name50);
		});

		it('不帶 body 回傳 400', async () => {
			const response = await fetch(`${server.baseUrl}/api/canvas`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe('無效的請求格式');
		});

		it('建立後 GET /api/canvas/list 應包含新 Canvas', async () => {
			const createResponse = await postCanvas(server.baseUrl, { name: 'list-verify-test' });
			expect(createResponse.status).toBe(201);
			const created = await createResponse.json();

			const listResponse = await fetch(`${server.baseUrl}/api/canvas/list`);
			const listBody = await listResponse.json();
			const found = listBody.canvases.find((c: any) => c.id === created.canvas.id);
			expect(found).toBeDefined();
			expect(found.name).toBe('list-verify-test');
		});

		it('canvasStore.create 拋出例外時回傳 500', async () => {
			const spy = vi.spyOn(canvasStore, 'create').mockRejectedValueOnce(new Error('模擬錯誤'));
			const response = await postCanvas(server.baseUrl, { name: 'error-test' });
			expect(response.status).toBe(500);
			const body = await response.json();
			expect(body.error).toBe('伺服器內部錯誤');
			spy.mockRestore();
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
