import type { WebSocketMessage, WebSocketResponse } from '../types/websocket.js';

export function serialize(message: WebSocketMessage | WebSocketResponse): string {
	return JSON.stringify(message);
}

export function deserialize(data: string | Buffer): WebSocketMessage {
	try {
		const jsonString = typeof data === 'string' ? data : data.toString('utf-8');

		const parsed = JSON.parse(jsonString);

		if (!parsed || typeof parsed !== 'object') {
			throw new Error('訊息必須是 JSON 物件');
		}

		if (typeof parsed.type !== 'string') {
			throw new Error('訊息缺少必要欄位: type');
		}

		return {
			type: parsed.type,
			requestId: parsed.requestId ?? '',
			payload: parsed.payload,
			ackId: parsed.ackId,
		};
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error('無效的 JSON 格式');
		}
		throw error;
	}
}
