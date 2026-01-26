import type { Socket } from 'socket.io';

export class WebSocketError extends Error {
  code: string;
  requestId?: string;
  podId?: string;

  constructor(code: string, message: string, requestId?: string, podId?: string) {
    super(message);
    this.name = 'WebSocketError';
    this.code = code;
    this.requestId = requestId;
    this.podId = podId;
  }
}

export function handleWebSocketError(
  socket: Socket,
  event: string,
  error: unknown,
  requestId?: string,
  podId?: string
): void {
  let errorMessage: string;
  let errorCode: string;

  if (error instanceof WebSocketError) {
    errorMessage = error.message;
    errorCode = error.code;
    requestId = requestId || error.requestId;
    podId = podId || error.podId;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = 'INTERNAL_ERROR';
  } else {
    errorMessage = 'An unknown error occurred';
    errorCode = 'UNKNOWN_ERROR';
  }

  const errorPayload = {
    requestId,
    success: false,
    error: errorMessage,
    code: errorCode,
    ...(podId && { podId }),
  };

  socket.emit(event, errorPayload);

  console.error(`[WebSocket Error] Event: ${event}, Code: ${errorCode}, Message: ${errorMessage}`);
}
