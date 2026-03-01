import {
	createTestServer,
	closeTestServer,
	createSocketClient,
	disconnectSocket,
	waitForEvent,
	type TestServerInstance,
} from '../setup';
import { createPod, postCanvas, postPod } from '../helpers';
import type { TestWebSocketClient } from '../setup';
import { WebSocketResponseEvents } from '../../src/schemas';

async function fetchPods(baseUrl: string, canvasId: string) {
	return fetch(`${baseUrl}/api/canvas/${canvasId}/pods`);
}

describe('GET /api/canvas/:id/pods', () => {
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

	it('成功取得 Pod 列表', async () => {
		await createPod(client);

		const response = await fetchPods(server.baseUrl, server.canvasId);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(Array.isArray(body.pods)).toBe(true);
		expect(body.pods.length).toBeGreaterThan(0);
	});

	it('Canvas 存在但沒有 Pod 時回傳空陣列', async () => {
		const createResponse = await postCanvas(server.baseUrl, { name: 'pod-api-empty-canvas' });
		expect(createResponse.status).toBe(201);
		const created = await createResponse.json();
		const emptyCanvasId = created.canvas.id;

		const response = await fetchPods(server.baseUrl, emptyCanvasId);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.pods).toEqual([]);
	});

	it('回傳資料包含 Pod 完整欄位', async () => {
		await createPod(client);

		const response = await fetchPods(server.baseUrl, server.canvasId);
		const body = await response.json();

		expect(body.pods.length).toBeGreaterThan(0);
		const pod = body.pods[0];

		expect(typeof pod.id).toBe('string');
		expect(typeof pod.name).toBe('string');
		expect(typeof pod.status).toBe('string');
		expect(typeof pod.workspacePath).toBe('string');
		expect(typeof pod.x).toBe('number');
		expect(typeof pod.y).toBe('number');
		expect(typeof pod.rotation).toBe('number');
		expect(Array.isArray(pod.skillIds)).toBe(true);
		expect(Array.isArray(pod.subAgentIds)).toBe(true);
		expect(Array.isArray(pod.mcpServerIds)).toBe(true);
		expect(typeof pod.model).toBe('string');
		expect(typeof pod.autoClear).toBe('boolean');
	});

	it('用 canvas name 取得 Pod 列表', async () => {
		const createResponse = await postCanvas(server.baseUrl, { name: 'pod-api-name-canvas' });
		expect(createResponse.status).toBe(201);

		const response = await fetchPods(server.baseUrl, 'pod-api-name-canvas');
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(Array.isArray(body.pods)).toBe(true);
	});

	it('找不到 Canvas 回傳 404', async () => {
		const response = await fetchPods(server.baseUrl, 'non-existent-canvas');
		expect(response.status).toBe(404);

		const body = await response.json();
		expect(body.error).toBe('找不到 Canvas');
	});

	it('用不存在的 UUID 查詢 Pod 列表回傳 404', async () => {
		const response = await fetchPods(server.baseUrl, '00000000-0000-4000-8000-000000000000');
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('找不到 Canvas');
	});
});

describe('POST /api/canvas/:id/pods', () => {
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

	it('成功建立 Pod（只傳 name, x, y），預設 model 為 opus', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'REST Pod', x: 100, y: 200 });
		expect(response.status).toBe(201);

		const body = await response.json();
		expect(body.pod).toBeDefined();
		expect(body.pod.name).toBe('REST Pod');
		expect(body.pod.x).toBe(100);
		expect(body.pod.y).toBe(200);
		expect(body.pod.rotation).toBe(0);
		expect(body.pod.model).toBe('opus');
	});

	it('成功建立 Pod 並指定 model 為 sonnet', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'Sonnet Pod', x: 0, y: 0, model: 'sonnet' });
		expect(response.status).toBe(201);

		const body = await response.json();
		expect(body.pod.model).toBe('sonnet');
	});

	it('用 canvas name 建立 Pod', async () => {
		const createResponse = await postCanvas(server.baseUrl, { name: 'post-pod-name-canvas' });
		expect(createResponse.status).toBe(201);

		const response = await postPod(server.baseUrl, 'post-pod-name-canvas', { name: 'Named Canvas Pod', x: 0, y: 0 });
		expect(response.status).toBe(201);
	});

	it('缺少 name 回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { x: 0, y: 0 });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('Pod 名稱不能為空');
	});

	it('name 為空字串回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: '', x: 0, y: 0 });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('Pod 名稱不能為空');
	});

	it('name 超過 100 字元回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'a'.repeat(101), x: 0, y: 0 });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('Pod 名稱不能超過 100 個字元');
	});

	it('缺少 x 回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'Pod', y: 0 });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('必須提供有效的 x 和 y 座標');
	});

	it('缺少 y 回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'Pod', x: 0 });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('必須提供有效的 x 和 y 座標');
	});

	it('無效 model 回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'Pod', x: 0, y: 0, model: 'gpt-4' });
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('無效的模型類型');
	});

	it('Canvas 不存在回傳 404', async () => {
		const response = await postPod(server.baseUrl, 'non-existent-canvas', { name: 'Pod', x: 0, y: 0 });
		expect(response.status).toBe(404);

		const body = await response.json();
		expect(body.error).toBe('找不到 Canvas');
	});

	it('無效 JSON body 回傳 400', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, 'not json', 'text/plain');
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('無效的請求格式');
	});

	it('用不存在的 UUID 建立 Pod 回傳 404', async () => {
		const response = await postPod(server.baseUrl, '00000000-0000-4000-8000-000000000000', {
			name: 'Test', x: 0, y: 0,
		});
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('找不到 Canvas');
	});

	it('建立 Pod 成功後 WebSocket client 收到 pod:created 事件', async () => {
		const eventPromise = waitForEvent<{ pod: { name: string; x: number; y: number } }>(
			client,
			WebSocketResponseEvents.POD_CREATED,
		);

		await postPod(server.baseUrl, server.canvasId, { name: 'WS Broadcast Pod', x: 10, y: 20 });

		const payload = await eventPromise;
		expect(payload.pod).toBeDefined();
		expect(payload.pod.name).toBe('WS Broadcast Pod');
		expect(payload.pod.x).toBe(10);
		expect(payload.pod.y).toBe(20);
	});

	it('回傳的 Pod 包含完整欄位', async () => {
		const response = await postPod(server.baseUrl, server.canvasId, { name: 'Full Field Pod', x: 50, y: 75 });
		expect(response.status).toBe(201);

		const body = await response.json();
		const pod = body.pod;

		expect(typeof pod.id).toBe('string');
		expect(typeof pod.name).toBe('string');
		expect(pod.status).toBe('idle');
		expect(typeof pod.workspacePath).toBe('string');
		expect(typeof pod.x).toBe('number');
		expect(typeof pod.y).toBe('number');
		expect(pod.rotation).toBe(0);
		expect(typeof pod.model).toBe('string');
		expect(Array.isArray(pod.skillIds)).toBe(true);
		expect(Array.isArray(pod.subAgentIds)).toBe(true);
		expect(Array.isArray(pod.mcpServerIds)).toBe(true);
		expect(typeof pod.autoClear).toBe('boolean');
	});
});
