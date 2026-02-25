import { WebSocketResponseEvents } from '../schemas';
import type { CursorMovePayload } from '../schemas';
import { connectionManager } from '../services/connectionManager.js';
import { cursorColorManager } from '../services/cursorColorManager.js';
import { socketService } from '../services/socketService.js';

// 記錄每個 connectionId 最後一次處理 cursor:move 的時間戳（ms）
const lastMoveTimestamp = new Map<string, number>();
const RATE_LIMIT_MS = 50;

export function broadcastCursorLeft(connectionId: string): void {
  lastMoveTimestamp.delete(connectionId);
  const canvasId = connectionManager.getCanvasId(connectionId);
  if (!canvasId) return;
  socketService.emitToCanvasExcept(canvasId, connectionId, WebSocketResponseEvents.CURSOR_LEFT, { connectionId });
  cursorColorManager.releaseColor(canvasId, connectionId);
}

export async function handleCursorMove(
  connectionId: string,
  payload: CursorMovePayload
): Promise<void> {
  const now = Date.now();
  const last = lastMoveTimestamp.get(connectionId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return;
  lastMoveTimestamp.set(connectionId, now);

  const canvasId = connectionManager.getCanvasId(connectionId);
  if (!canvasId) return;

  const color = cursorColorManager.assignColor(canvasId, connectionId);

  socketService.emitToCanvasExcept(canvasId, connectionId, WebSocketResponseEvents.CURSOR_MOVED, {
    connectionId,
    x: payload.x,
    y: payload.y,
    color,
  });
}
