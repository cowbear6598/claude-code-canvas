// WebSocket Response Utility Functions
// Provides helper functions for sending standardized WebSocket responses

import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../types/index.js';

/**
 * Emit a success response to a specific socket
 */
export function emitSuccess<T>(
  socket: Socket,
  event: WebSocketResponseEvents,
  data: T
): void {
  socket.emit(event, data);
}

/**
 * Emit an error response to a specific socket
 */
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

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Generate error code from error type
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    // Map common error types to codes
    if (error.message.includes('not found')) {
      return 'NOT_FOUND';
    }
    if (error.message.includes('already exists')) {
      return 'ALREADY_EXISTS';
    }
    if (error.message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    if (error.message.includes('permission')) {
      return 'PERMISSION_DENIED';
    }
  }
  return 'INTERNAL_ERROR';
}
