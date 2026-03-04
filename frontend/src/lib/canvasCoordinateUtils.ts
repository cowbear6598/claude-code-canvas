import type { Position } from '@/types'

export const CANVAS_COORDINATE_MIN = -100000
export const CANVAS_COORDINATE_MAX = 100000

export function validateCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(CANVAS_COORDINATE_MIN, Math.min(CANVAS_COORDINATE_MAX, value))
}

export function screenToCanvasPosition(
  screenPos: Position,
  viewport: { offset: { x: number; y: number }; zoom: number }
): Position {
  return {
    x: validateCoordinate((screenPos.x - viewport.offset.x) / viewport.zoom),
    y: validateCoordinate((screenPos.y - viewport.offset.y) / viewport.zoom)
  }
}
