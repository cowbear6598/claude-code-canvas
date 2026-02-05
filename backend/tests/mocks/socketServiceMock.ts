// Socket Service Mock
// 使用方式：
// 1. 在測試檔案頂部調用 mockSocketService()
// 2. 使用 getEmittedEvents() 或 getLastEmittedEvent() 檢查 socket 事件
// 3. 使用 resetSocketMock() 清除事件記錄

import { mock } from 'bun:test';

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

export const mockEmitToPod = mock((podId: string, event: string, payload: unknown): void => {
  emittedEvents.push({ event, payload });
});

export const mockEmitToAll = mock((event: string, payload: unknown): void => {
  emittedEvents.push({ event, payload });
});

export const mockBroadcastToCanvas = mock(
  (socketId: string, canvasId: string, event: string, payload: unknown): void => {
    emittedEvents.push({ event, payload });
  }
);

export function mockSocketService(): void {
  mock.module('../../src/services/socketService.js', () => ({
    socketService: {
      initialize: mock(),
      emitToPod: mockEmitToPod,
      emitToAll: mockEmitToAll,
      broadcastToCanvas: mockBroadcastToCanvas,
      getIO: mock(),
      emitConnectionReady: mock(),
      emitPodDeletedBroadcast: mock(),
      joinPodRoom: mock(),
      leavePodRoom: mock(),
      joinCanvasRoom: mock(),
      leaveCanvasRoom: mock(),
      cleanupSocket: mock(),
    },
  }));
}
