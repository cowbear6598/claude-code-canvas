import type { WebSocketMessage, WebSocketResponse } from '../types/websocket.js';

export function serialize(message: WebSocketMessage | WebSocketResponse): string {
	return JSON.stringify(message);
}

export function deserialize(data: string | Buffer): WebSocketMessage {
	const jsonString = typeof data === 'string' ? data : data.toString('utf-8');

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonString);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error('無效的 JSON 格式');
		}
		throw error;
	}

	if (!parsed || typeof parsed !== 'object') {
		throw new Error('訊息必須是 JSON 物件');
	}

	const obj = parsed as Record<string, unknown>;

	if (typeof obj.type !== 'string') {
		throw new Error('訊息缺少必要欄位: type');
	}

	return {
		type: obj.type,
		requestId: (obj.requestId as string) ?? '',
		payload: obj.payload,
		ackId: obj.ackId as string | undefined,
	};
}
