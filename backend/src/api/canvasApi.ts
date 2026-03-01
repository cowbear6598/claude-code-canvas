import { canvasStore } from '../services/canvasStore.js';
import { podStore } from '../services/podStore.js';
import { socketService } from '../services/socketService.js';
import { cursorColorManager } from '../services/cursorColorManager.js';
import { WebSocketResponseEvents } from '../schemas/index.js';
import { JSON_HEADERS } from './constants.js';
import { toCanvasDto } from '../utils/canvasDto.js';
import type { Canvas } from '../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function resolveCanvas(idOrName: string): Canvas | undefined {
	if (!idOrName) return undefined;
	if (UUID_REGEX.test(idOrName)) {
		return canvasStore.getById(idOrName);
	}
	return canvasStore.getByName(idOrName);
}

export async function handleDeleteCanvas(_req: Request, params: Record<string, string>): Promise<Response> {
	const canvas = resolveCanvas(params.id);
	if (!canvas) {
		return jsonResponse({ error: '找不到 Canvas' }, 404);
	}

	const { id: canvasId } = canvas;

	const result = await canvasStore.delete(canvasId);
	if (!result.success) {
		return jsonResponse({ error: '刪除 Canvas 時發生錯誤' }, 500);
	}

	cursorColorManager.removeCanvas(canvasId);
	socketService.emitToAll(WebSocketResponseEvents.CANVAS_DELETED, { requestId: 'system', success: true, canvasId });

	return jsonResponse({ success: true }, 200);
}

function isValidCreateCanvasBody(body: unknown): body is { name: string } {
	return (
		body !== null &&
		typeof body === 'object' &&
		'name' in body &&
		typeof (body as Record<string, unknown>).name === 'string'
	);
}

export function handleListPods(_req: Request, params: Record<string, string>): Response {
	const canvas = resolveCanvas(params.id);
	if (!canvas) {
		return jsonResponse({ error: '找不到 Canvas' }, 404);
	}

	const pods = podStore.getAll(canvas.id);
	return jsonResponse({ pods }, 200);
}

export function handleListCanvases(_req: Request, _params: Record<string, string>): Response {
	const canvases = canvasStore.list();
	return jsonResponse({ canvases: canvases.map(toCanvasDto) }, 200);
}

export async function handleCreateCanvas(req: Request, _params: Record<string, string>): Promise<Response> {
	let body: unknown;

	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: '無效的請求格式' }, 400);
	}

	if (!isValidCreateCanvasBody(body)) {
		return jsonResponse({ error: 'Canvas 名稱不能為空' }, 400);
	}

	const name = body.name;

	const result = await canvasStore.create(name);

	if (!result.success) {
		return jsonResponse({ error: result.error }, 400);
	}

	const canvasDto = toCanvasDto(result.data!);

	socketService.emitToAll(WebSocketResponseEvents.CANVAS_CREATED, { requestId: 'system', success: true, canvas: canvasDto });

	return jsonResponse({ canvas: canvasDto }, 201);
}
