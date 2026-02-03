// Socket Service Mock
// 使用方式：
// 1. 在測試檔案頂部調用 mockSocketService()
// 2. 使用 getEmittedEvents() 或 getLastEmittedEvent() 檢查 socket 事件
// 3. 使用 resetSocketMock() 清除事件記錄

import { vi } from 'vitest';

interface EmittedEvent {
  event: string;
  payload: any;
}

let emittedEvents: EmittedEvent[] = [];

export function getEmittedEvents(): EmittedEvent[] {
  return emittedEvents;
}

export function getLastEmittedEvent(eventName: string): any | null {
  const events = emittedEvents.filter((e) => e.event === eventName);
  if (events.length === 0) {
    return null;
  }
  return events[events.length - 1].payload;
}

export function clearEmittedEvents(): void {
  emittedEvents = [];
}

export function resetSocketMock(): void {
  clearEmittedEvents();
}

export const mockEmitToPod = vi.fn((podId: string, event: string, payload: unknown): void => {
  emittedEvents.push({ event, payload });
});

export const mockEmitToAll = vi.fn((event: string, payload: unknown): void => {
  emittedEvents.push({ event, payload });
});

export const mockBroadcastToCanvas = vi.fn(
  (socketId: string, canvasId: string, event: string, payload: unknown): void => {
    emittedEvents.push({ event, payload });
  }
);

export function mockSocketService(): void {
  vi.mock('../../src/services/socketService.js', () => ({
    socketService: {
      initialize: vi.fn(),
      emitToPod: mockEmitToPod,
      emitToAll: mockEmitToAll,
      broadcastToCanvas: mockBroadcastToCanvas,
      getIO: vi.fn(),
      emitConnectionReady: vi.fn(),
      emitPodDeletedBroadcast: vi.fn(),
      joinPodRoom: vi.fn(),
      leavePodRoom: vi.fn(),
      joinCanvasRoom: vi.fn(),
      leaveCanvasRoom: vi.fn(),
      cleanupSocket: vi.fn(),
    },
  }));
}
