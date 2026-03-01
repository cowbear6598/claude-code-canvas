import { canvasStore } from '../services/canvasStore.js';
import { JSON_HEADERS } from './constants.js';
import type { Canvas } from '../types/index.js';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function resolveCanvas(idOrName: string): Canvas | undefined {
	if (!idOrName) return undefined;
	if (UUID_REGEX.test(idOrName)) {
		return canvasStore.getById(idOrName);
	}
	return canvasStore.getByName(idOrName);
}
