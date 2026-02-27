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
		logger.log('Startup', 'Complete', '[WebSocket] 服務已初始化');

		this.startHeartbeat();
	}

	emitToAll(event: string, payload: unknown): void {
		this.emitToAllExcept('', event, payload);
	}

	emitToAllExcept(excludeConnectionId: string, event: string, payload: unknown): void {
		const connections = connectionManager.getAll();
		for (const connection of connections) {
			if (connection.id === excludeConnectionId) continue;
			this.emitToConnection(connection.id, event, payload);
		}
	}

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
			connection.webSocket.send(serialize(response));
		} catch (error) {
			logger.log('Connection', 'Error', `Failed to send message to ${connectionId}: ${error}`);
		}
	}

	emitConnectionReady(connectionId: string, payload: ConnectionReadyPayload): void {
		this.emitToConnection(connectionId, WebSocketResponseEvents.CONNECTION_READY, payload);
	}

	joinCanvasRoom(connectionId: string, canvasId: string): void {
		this.leaveCanvasRoom(connectionId);

		const roomName = `canvas:${canvasId}`;
		roomManager.join(connectionId, roomName);
		connectionManager.setCanvasId(connectionId, canvasId);
	}

	leaveCanvasRoom(connectionId: string): void {
		const currentCanvasId = connectionManager.getCanvasId(connectionId);
		if (!currentCanvasId) {
			return;
		}

		const roomName = `canvas:${currentCanvasId}`;
		roomManager.leave(connectionId, roomName);
		connectionManager.setCanvasId(connectionId, '');
	}

	emitToCanvas(canvasId: string, event: string, payload: unknown): void {
		this.emitToCanvasExcept(canvasId, '', event, payload);
	}

	emitToCanvasExcept(canvasId: string, excludeConnectionId: string, event: string, payload: unknown): void {
		const roomName = `canvas:${canvasId}`;
		const members = roomManager.getMembers(roomName);

		for (const connectionId of members) {
			if (connectionId === excludeConnectionId) continue;
			this.emitToConnection(connectionId, event, payload);
		}
	}

	cleanupSocket(connectionId: string): void {
		roomManager.leaveAll(connectionId);
		connectionManager.remove(connectionId);
		this.clearHeartbeatTimeout(connectionId);
	}

	private clearHeartbeatTimeout(connectionId: string): void {
		const timeout = this.heartbeatTimeouts.get(connectionId);
		if (timeout) {
			clearTimeout(timeout);
			this.heartbeatTimeouts.delete(connectionId);
		}
	}

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

		logger.log('Startup', 'Complete', '[Heartbeat] 已啟動');
	}

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
			connection.webSocket.send(serialize(response));
		} catch (error) {
			logger.log('Connection', 'Error', `Failed to send heartbeat to ${connectionId}: ${error}`);
			return;
		}

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
				conn.webSocket.close(1000, 'Heartbeat timeout');
			}
		}, this.HEARTBEAT_TIMEOUT);

		this.heartbeatTimeouts.set(connectionId, timeout);
	}

	handleHeartbeatPong(connectionId: string): void {
		connectionManager.updateHeartbeat(connectionId);
		this.clearHeartbeatTimeout(connectionId);
	}

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
