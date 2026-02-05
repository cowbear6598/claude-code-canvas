import type { WebSocketMessage, WebSocketResponse } from '../types/websocket.js';

/**
 * 序列化訊息為 JSON 字串
 */
export function serialize(message: WebSocketMessage | WebSocketResponse): string {
	return JSON.stringify(message);
}

/**
 * 反序列化訊息
 * @throws {Error} 當訊息格式不正確時
 */
export function deserialize(data: string | Buffer): WebSocketMessage {
	try {
		// 處理 Buffer 類型
		const jsonString = typeof data === 'string' ? data : data.toString('utf-8');

		// 解析 JSON
		const parsed = JSON.parse(jsonString);

		// 驗證必要欄位
		if (!parsed || typeof parsed !== 'object') {
			throw new Error('訊息必須是 JSON 物件');
		}

		if (typeof parsed.type !== 'string') {
			throw new Error('訊息缺少必要欄位: type');
		}

		// 回傳解析後的訊息（requestId 和 ackId 是可選的）
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
