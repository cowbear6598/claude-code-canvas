import { logger } from '../utils/logger.js';
import { WebSocketResponseEvents } from '../schemas';
import type { ConnectionReadyPayload } from '../types';
import type { WebSocketResponse } from '../types/websocket.js';
import { connectionManager } from './connectionManager.js';
import { roomManager } from './roomManager.js';
import { serialize } from '../utils/messageSerializer.js';

class SocketService {
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private heartbeatTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private initialized = false;

	private readonly HEARTBEAT_INTERVAL = 15000;
	private readonly HEARTBEAT_TIMEOUT = 10000;
	private readonly MAX_MISSED_HEARTBEATS = 2;

	initialize(): void {
		if (this.initialized) {
			logger.log('Startup', 'Complete', '[WebSocket] Already initialized');
			return;
		}

		this.initialized = true;
		logger.log('Startup', 'Complete', '[WebSocket] Service initialized');

		this.startHeartbeat();
	}

	/**
	 * 發送訊息給所有連線
	 */
	emitToAll(event: string, payload: unknown): void {
		const connections = connectionManager.getAll();
		for (const connection of connections) {
			this.emitToConnection(connection.id, event, payload);
		}
	}

	/**
	 * 發送訊息給指定連線
	 */
	emitToConnection(connectionId: string, event: string, payload: unknown): void {
		const connection = connectionManager.get(connectionId);
		if (!connection) {
			return;
		}

		const response: WebSocketResponse = {
			type: event,
			requestId: '',
			success: true,
			payload,
		};

		try {
			connection.ws.send(serialize(response));
		} catch (error) {
			logger.log('Connection', 'Error', `Failed to send message to ${connectionId}: ${error}`);
		}
	}

	/**
	 * 發送連線就緒訊息
	 */
	emitConnectionReady(connectionId: string, payload: ConnectionReadyPayload): void {
		this.emitToConnection(connectionId, WebSocketResponseEvents.CONNECTION_READY, payload);
	}

	/**
	 * 加入 Canvas Room
	 */
	joinCanvasRoom(connectionId: string, canvasId: string): void {
		this.leaveCanvasRoom(connectionId);

		const roomName = `canvas:${canvasId}`;
		roomManager.join(connectionId, roomName);
		connectionManager.setCanvasId(connectionId, canvasId);
	}

	/**
	 * 離開 Canvas Room
	 */
	leaveCanvasRoom(connectionId: string): void {
		const currentCanvasId = connectionManager.getCanvasId(connectionId);
		if (!currentCanvasId) {
			return;
		}

		const roomName = `canvas:${currentCanvasId}`;
		roomManager.leave(connectionId, roomName);
		connectionManager.setCanvasId(connectionId, '');
	}

	/**
	 * 發送訊息給指定 Canvas 的所有連線
	 */
	emitToCanvas(canvasId: string, event: string, payload: unknown): void {
		const roomName = `canvas:${canvasId}`;
		const members = roomManager.getMembers(roomName);

		for (const connectionId of members) {
			this.emitToConnection(connectionId, event, payload);
		}
	}

	/**
	 * 清理連線
	 */
	cleanupSocket(connectionId: string): void {
		roomManager.leaveAll(connectionId);
		connectionManager.remove(connectionId);
		this.clearHeartbeatTimeout(connectionId);
	}

	/**
	 * 清除心跳超時計時器
	 */
	private clearHeartbeatTimeout(connectionId: string): void {
		const timeout = this.heartbeatTimeouts.get(connectionId);
		if (timeout) {
			clearTimeout(timeout);
			this.heartbeatTimeouts.delete(connectionId);
		}
	}

	/**
	 * 開始心跳檢測
	 */
	private startHeartbeat(): void {
		if (this.heartbeatInterval) {
			return;
		}

		this.heartbeatInterval = setInterval(() => {
			const connections = connectionManager.getAll();
			for (const connection of connections) {
				this.sendHeartbeatPing(connection.id);
			}
		}, this.HEARTBEAT_INTERVAL);

		logger.log('Startup', 'Complete', '[Heartbeat] Started');
	}

	/**
	 * 發送心跳 ping
	 */
	private sendHeartbeatPing(connectionId: string): void {
		const connection = connectionManager.get(connectionId);
		if (!connection) {
			return;
		}

		this.clearHeartbeatTimeout(connectionId);

		const timestamp = Date.now();
		const ackId = `heartbeat-${connectionId}-${timestamp}`;
		const response: WebSocketResponse = {
			type: WebSocketResponseEvents.HEARTBEAT_PING,
			requestId: '',
			success: true,
			payload: { timestamp },
			ackId,
		};

		try {
			connection.ws.send(serialize(response));
		} catch (error) {
			logger.log('Connection', 'Error', `Failed to send heartbeat to ${connectionId}: ${error}`);
			return;
		}

		// 設定超時檢查
		const timeout = setTimeout(() => {
			const conn = connectionManager.get(connectionId);
			if (!conn) {
				return;
			}

			connectionManager.incrementMissedHeartbeats(connectionId);

			const missed = conn.missedHeartbeats;
			logger.log('Connection', 'Error', `Connection ${connectionId} missed heartbeat (${missed}/${this.MAX_MISSED_HEARTBEATS})`);

			if (missed >= this.MAX_MISSED_HEARTBEATS) {
				logger.log('Connection', 'Delete', `Connection ${connectionId} disconnected due to heartbeat timeout`);
				this.clearHeartbeatTimeout(connectionId);
				conn.ws.close(1000, 'Heartbeat timeout');
			}
		}, this.HEARTBEAT_TIMEOUT);

		this.heartbeatTimeouts.set(connectionId, timeout);
	}

	/**
	 * 處理心跳 pong 回應
	 */
	handleHeartbeatPong(connectionId: string): void {
		connectionManager.updateHeartbeat(connectionId);
		this.clearHeartbeatTimeout(connectionId);
	}

	/**
	 * 停止心跳檢測
	 */
	stopHeartbeat(): void {
		if (!this.heartbeatInterval) {
			return;
		}

		clearInterval(this.heartbeatInterval);
		this.heartbeatInterval = null;

		this.heartbeatTimeouts.forEach((timeout) => clearTimeout(timeout));
		this.heartbeatTimeouts.clear();

		logger.log('Startup', 'Complete', '[Heartbeat] Stopped');
	}
}

export const socketService = new SocketService();
