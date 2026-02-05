import type { WebSocketResponseEvents } from '../schemas';
import { socketService } from '../services/socketService.js';

export function emitSuccess<T>(
	connectionId: string,
	event: WebSocketResponseEvents,
	data: T
): void {
	socketService.emitToConnection(connectionId, event, data);
}

export function emitError(
	connectionId: string,
	event: WebSocketResponseEvents,
	error: string | Error,
	requestId?: string,
	podId?: string,
	code: string = 'INTERNAL_ERROR'
): void {
	const errorMessage = error instanceof Error ? error.message : error;

	socketService.emitToConnection(connectionId, event, {
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
	connectionId: string,
	event: WebSocketResponseEvents,
	requestId: string,
	data: T
): void {
	socketService.emitToConnection(connectionId, event, {
		requestId,
		success: true,
		...data,
	});
}

export function sendErrorResponse(
	connectionId: string,
	requestId: string,
	code: string,
	message: string
): void {
	socketService.emitToConnection(connectionId, 'error', {
		requestId,
		success: false,
		error: {
			code,
			message,
		},
	});
}
