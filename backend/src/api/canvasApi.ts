import { canvasStore } from '../services/canvasStore.js';
import { JSON_HEADERS } from './constants.js';

export function handleListCanvases(_req: Request): Response {
	const canvases = canvasStore.list();

	const body = JSON.stringify({
		canvases: canvases.map((canvas) => ({
			id: canvas.id,
			name: canvas.name,
			createdAt: canvas.createdAt.toISOString(),
			sortIndex: canvas.sortIndex,
		})),
	});

	return new Response(body, { status: 200, headers: JSON_HEADERS });
}
