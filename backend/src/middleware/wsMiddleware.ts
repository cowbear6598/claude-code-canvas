import { z } from 'zod';
import { WebSocketError, handleWebSocketError } from './wsErrorHandler.js';

export type ValidatedHandler<T> = (
	connectionId: string,
	payload: T,
	requestId: string
) => Promise<void>;

export function createValidatedHandler<T>(
	schema: z.ZodType<T>,
	handler: ValidatedHandler<T>,
	responseEvent: string
): (connectionId: string, payload: unknown, requestId: string) => Promise<void> {
	return async (connectionId: string, payload: unknown, requestId: string) => {
		const result = schema.safeParse(payload);

		if (!result.success) {
			handleWebSocketError(
				connectionId,
				responseEvent,
				new WebSocketError('VALIDATION_ERROR', result.error.message),
				requestId
			);
			return;
		}

		try {
			await handler(connectionId, result.data, requestId);
		} catch (error) {
			handleWebSocketError(connectionId, responseEvent, error, requestId);
		}
	};
}
