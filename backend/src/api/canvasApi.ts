import { canvasStore } from '../services/canvasStore.js';
import { socketService } from '../services/socketService.js';
import { WebSocketResponseEvents } from '../schemas/index.js';
import { JSON_HEADERS } from './constants.js';
import { toCanvasDto } from '../utils/canvasDto.js';

function isValidCreateCanvasBody(body: unknown): body is { name: string } {
	return (
		body !== null &&
		typeof body === 'object' &&
		'name' in body &&
		typeof (body as Record<string, unknown>).name === 'string'
	);
}

export function handleListCanvases(_req: Request): Response {
	const canvases = canvasStore.list();

	const body = JSON.stringify({
		canvases: canvases.map(toCanvasDto),
	});

	return new Response(body, { status: 200, headers: JSON_HEADERS });
}

export async function handleCreateCanvas(req: Request): Promise<Response> {
	let body: unknown;

	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: '無效的請求格式' }), { status: 400, headers: JSON_HEADERS });
	}

	if (!isValidCreateCanvasBody(body)) {
		return new Response(JSON.stringify({ error: 'Canvas 名稱不能為空' }), { status: 400, headers: JSON_HEADERS });
	}

	const name = body.name;

	const result = await canvasStore.create(name);

	if (!result.success) {
		return new Response(JSON.stringify({ error: result.error }), { status: 400, headers: JSON_HEADERS });
	}

	const canvasDto = toCanvasDto(result.data!);

	socketService.emitToAll(WebSocketResponseEvents.CANVAS_CREATED, { requestId: 'system', success: true, canvas: canvasDto });

	return new Response(JSON.stringify({ canvas: canvasDto }), { status: 201, headers: JSON_HEADERS });
}
