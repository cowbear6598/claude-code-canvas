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

export function emitNotFound(
	connectionId: string,
	responseEvent: WebSocketResponseEvents,
	entityName: string,
	resourceId: string,
	requestId: string
): void {
	emitError(connectionId, responseEvent, `${entityName} 找不到: ${resourceId}`, requestId, undefined, 'NOT_FOUND');
}

export { getErrorMessage } from './errorHelpers.js';

