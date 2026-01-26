import type { Socket } from 'socket.io';
import { z } from 'zod';
import { WebSocketError, handleWebSocketError } from './wsErrorHandler.js';

export type ValidatedHandler<T> = (
  socket: Socket,
  payload: T,
  requestId: string
) => Promise<void>;

export function createValidatedHandler<T>(
  schema: z.ZodType<T>,
  handler: ValidatedHandler<T>,
  responseEvent: string
): (socket: Socket, payload: unknown) => Promise<void> {
  return async (socket: Socket, payload: unknown) => {
    // Parse and validate
    const result = schema.safeParse(payload);

    if (!result.success) {
      const requestId = extractRequestId(payload);
      handleWebSocketError(
        socket,
        responseEvent,
        new WebSocketError('VALIDATION_ERROR', result.error.message),
        requestId
      );
      return;
    }

    const requestId = (result.data as { requestId: string }).requestId;

    try {
      await handler(socket, result.data, requestId);
    } catch (error) {
      handleWebSocketError(socket, responseEvent, error, requestId);
    }
  };
}

function extractRequestId(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload && 'requestId' in payload) {
    return (payload as { requestId: string }).requestId;
  }
  return undefined;
}
