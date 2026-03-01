import {
	createTestServer,
	closeTestServer,
	createSocketClient,
	disconnectSocket,
	type TestServerInstance,
} from '../setup';
import { createPod, postCanvas } from '../helpers';
import type { TestWebSocketClient } from '../setup';

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
		expect(typeof pod.color).toBe('string');
		expect(typeof pod.status).toBe('string');
		expect(typeof pod.workspacePath).toBe('string');
		expect(typeof pod.x).toBe('number');
		expect(typeof pod.y).toBe('number');
		expect(typeof pod.rotation).toBe('number');
		expect(typeof pod.createdAt).toBe('string');
		expect(new Date(pod.createdAt).toISOString()).toBe(pod.createdAt);
		expect(typeof pod.lastActiveAt).toBe('string');
		expect(new Date(pod.lastActiveAt).toISOString()).toBe(pod.lastActiveAt);
		expect(Array.isArray(pod.skillIds)).toBe(true);
		expect(Array.isArray(pod.subAgentIds)).toBe(true);
		expect(Array.isArray(pod.mcpServerIds)).toBe(true);
		expect(typeof pod.model).toBe('string');
		expect(typeof pod.needsForkSession).toBe('boolean');
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
