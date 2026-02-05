import { v4 as uuidv4 } from 'uuid';
import type { ServerWebSocket } from 'bun';
import type { ClientConnection } from '../types/websocket.js';

/**
 * WebSocket 連線管理器
 */
class ConnectionManager {
	private connections: Map<string, ClientConnection> = new Map();

	/**
	 * 新增連線
	 * @returns 連線 ID
	 */
	add(ws: ServerWebSocket<{ connectionId: string }>): string {
		const id = uuidv4();
		const connection: ClientConnection = {
			id,
			ws,
			canvasId: null,
			lastHeartbeat: Date.now(),
			missedHeartbeats: 0,
		};
		this.connections.set(id, connection);
		return id;
	}

	/**
	 * 移除連線
	 */
	remove(id: string): void {
		this.connections.delete(id);
	}

	/**
	 * 取得連線
	 */
	get(id: string): ClientConnection | undefined {
		return this.connections.get(id);
	}
    /**
     * 取得所有連線
	 */
	getAll(): ClientConnection[] {
		return Array.from(this.connections.values());
	}

	/**
	 * 設定連線的 Canvas ID
	 */
	setCanvasId(id: string, canvasId: string): void {
		const connection = this.connections.get(id);
		if (connection) {
			connection.canvasId = canvasId;
		}
	}

	/**
	 * 取得連線的 Canvas ID
	 */
	getCanvasId(id: string): string | null {
		const connection = this.connections.get(id);
		return connection?.canvasId ?? null;
	}

	/**
	 * 更新最後心跳時間
	 */
	updateHeartbeat(id: string): void {
		const connection = this.connections.get(id);
		if (connection) {
			connection.lastHeartbeat = Date.now();
			connection.missedHeartbeats = 0;
		}
	}

	/**
	 * 增加遺失心跳次數
	 */
	incrementMissedHeartbeats(id: string): void {
		const connection = this.connections.get(id);
		if (connection) {
			connection.missedHeartbeats++;
		}
	}
}

export const connectionManager = new ConnectionManager();
