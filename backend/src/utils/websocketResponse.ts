import type { Socket } from 'socket.io';
import type { WebSocketResponseEvents } from '../schemas/index.js';

export function emitSuccess<T>(
  socket: Socket,
  event: WebSocketResponseEvents,
  data: T
): void {
  socket.emit(event, data);
}

export function emitError(
  socket: Socket,
  event: WebSocketResponseEvents,
  error: string | Error,
  requestId?: string,
  podId?: string,
  code: string = 'INTERNAL_ERROR'
): void {
  const errorMessage = error instanceof Error ? error.message : error;

  socket.emit(event, {
    requestId,
    podId,
    success: false,
    error: errorMessage,
    code,
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '發生未知錯誤';
}

export function sendSuccessResponse<T>(
  socket: Socket,
  event: WebSocketResponseEvents,
  requestId: string,
  data: T
): void {
  socket.emit(event, {
    requestId,
    success: true,
    ...data,
  });
}

export function sendErrorResponse(
  socket: Socket,
  requestId: string,
  code: string,
  message: string
): void {
  socket.emit('error', {
    requestId,
    success: false,
    error: {
      code,
      message,
    },
  });
}
