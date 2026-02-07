import { socketService } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

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
	connectionId: string,
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

	socketService.emitToConnection(connectionId, event, errorPayload);

	logger.error('WebSocket', 'Error', `Event: ${event}, Code: ${errorCode}, Message: ${errorMessage}`);
}
