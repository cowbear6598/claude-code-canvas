import type { ServerWebSocket } from 'bun';

/**
 * WebSocket 訊息格式
 */
export interface WebSocketMessage {
	/** 事件類型，如 'pod:create' */
	type: string;
	/** 請求追蹤 ID */
	requestId: string;
	/** 事件資料 */
	payload: unknown;
	/** Ack 確認 ID（用於 ack 回應訊息） */
	ackId?: string;
}

/**
 * WebSocket 回應格式
 */
export interface WebSocketResponse {
	/** 回應事件類型 */
	type: string;
	/** 對應的請求 ID */
	requestId: string;
	/** 是否成功 */
	success: boolean;
	/** 回應資料 */
	payload?: unknown;
	/** 錯誤訊息 */
	error?: string;
	/** 錯誤代碼 */
	code?: string;
	/** 需要 ack 確認的 ID（用於心跳等需要確認的訊息） */
	ackId?: string;
}

/**
 * 客戶端連線資訊
 */
export interface ClientConnection {
	/** 連線 ID (使用 uuid) */
	id: string;
	/** Bun 的 WebSocket 物件 */
	webSocket: ServerWebSocket<{ connectionId: string }>;
	/** 目前所在的 Canvas ID */
	canvasId: string | null;
	/** 最後心跳時間戳 */
	lastHeartbeat: number;
	/** 遺失的心跳次數 */
	missedHeartbeats: number;
}
