import type { Canvas } from '../types/index.js';

export interface CanvasDto {
	id: string;
	name: string;
	createdAt: string;
	sortIndex: number;
}

export function toCanvasDto(canvas: Canvas): CanvasDto {
	return {
		id: canvas.id,
		name: canvas.name,
		createdAt: canvas.createdAt.toISOString(),
		sortIndex: canvas.sortIndex,
	};
}
