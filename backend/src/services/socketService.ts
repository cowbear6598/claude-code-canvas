import {Server as HttpServer} from 'http';
import {Server as SocketIOServer, Socket} from 'socket.io';
import {config} from '../config/index.js';
import {logger} from '../utils/logger.js';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {
    ConnectionReadyPayload,
} from '../types/index.js';

class SocketService {
    private io: SocketIOServer | null = null;
    private socketToCanvasRoom: Map<string, string> = new Map();
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private socketMissedHeartbeats: Map<string, number> = new Map();
    private socketTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

    private readonly HEARTBEAT_INTERVAL = 15000;
    private readonly HEARTBEAT_TIMEOUT = 10000;
    private readonly MAX_MISSED_HEARTBEATS = 2;

    initialize(httpServer: HttpServer): void {
        if (this.io) {
            logger.log('Startup', 'Complete', '[Socket.io] Already initialized');
            return;
        }

        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: config.corsOrigin,
                methods: ['GET', 'POST'],
            },
            pingInterval: 10000,
            pingTimeout: 5000,
            maxHttpBufferSize: 10 * 1024 * 1024,
        });

        logger.log('Startup', 'Complete', '[Socket.io] Server initialized');

        this.startHeartbeat();
    }

    getIO(): SocketIOServer {
        if (!this.io) {
            throw new Error('Socket.io 尚未初始化。請先呼叫 initialize()');
        }
        return this.io;
    }

    emitToAll(event: string, payload: unknown): void {
        if (!this.io) {
            return;
        }

        this.io.emit(event, payload);
    }

    private emitToSocket(socketId: string, event: string, payload: unknown): void {
        if (!this.io) {
            return;
        }

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) {
            return;
        }

        socket.emit(event, payload);
    }

    emitConnectionReady(socketId: string, payload: ConnectionReadyPayload): void {
        this.emitToSocket(socketId, WebSocketResponseEvents.CONNECTION_READY, payload);
    }

    joinCanvasRoom(socketId: string, canvasId: string): void {
        if (!this.io) {
            return;
        }

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) {
            return;
        }

        this.leaveCanvasRoom(socketId);

        const roomName = `canvas:${canvasId}`;
        socket.join(roomName);
        this.socketToCanvasRoom.set(socketId, canvasId);
    }

    leaveCanvasRoom(socketId: string): void {
        if (!this.io) {
            return;
        }

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) {
            return;
        }

        const currentCanvasId = this.socketToCanvasRoom.get(socketId);
        if (!currentCanvasId) {
            return;
        }

        const roomName = `canvas:${currentCanvasId}`;
        socket.leave(roomName);
        this.socketToCanvasRoom.delete(socketId);
    }

    broadcastToAll(excludeSocketId: string, event: string, payload: unknown): void {
        if (!this.io) {
            return;
        }

        const socket = this.io.sockets.sockets.get(excludeSocketId);
        if (!socket) {
            return;
        }

        socket.broadcast.emit(event, payload);
    }

    emitToCanvas(canvasId: string, event: string, payload: unknown): void {
        if (!this.io) {
            return;
        }

        const roomName = `canvas:${canvasId}`;
        this.io.to(roomName).emit(event, payload);
    }

    cleanupSocket(socketId: string): void {
        this.leaveCanvasRoom(socketId);
        this.socketMissedHeartbeats.delete(socketId);
        this.clearSocketTimeout(socketId);
    }

    private clearSocketTimeout(socketId: string): void {
        const timeout = this.socketTimeouts.get(socketId);
        if (!timeout) {
            return;
        }

        clearTimeout(timeout);
        this.socketTimeouts.delete(socketId);
    }

    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            return;
        }

        this.heartbeatInterval = setInterval(() => {
            if (!this.io) {
                return;
            }

            this.io.sockets.sockets.forEach((socket) => {
                this.sendHeartbeatPing(socket);
            });
        }, this.HEARTBEAT_INTERVAL);

        logger.log('Startup', 'Complete', '[Heartbeat] Started');
    }

    private sendHeartbeatPing(socket: Socket): void {
        const socketId = socket.id;
        const timestamp = Date.now();

        this.clearSocketTimeout(socketId);

        let ackReceived = false;

        socket.emit(
            WebSocketResponseEvents.HEARTBEAT_PING,
            {timestamp},
            (_: { timestamp: number }) => {
                ackReceived = true;
                this.socketMissedHeartbeats.set(socketId, 0);
            }
        );

        const timeout = setTimeout(() => {
            if (ackReceived) {
                return;
            }

            if (!this.io?.sockets.sockets.has(socketId)) {
                return;
            }

            const currentMissed = this.socketMissedHeartbeats.get(socketId) || 0;
            const newMissed = currentMissed + 1;
            this.socketMissedHeartbeats.set(socketId, newMissed);

            logger.log('Connection', 'Error', `Socket ${socketId} missed heartbeat (${newMissed}/${this.MAX_MISSED_HEARTBEATS})`);

            if (newMissed >= this.MAX_MISSED_HEARTBEATS) {
                logger.log('Connection', 'Delete', `Socket ${socketId} disconnected due to heartbeat timeout`);
                this.clearSocketTimeout(socketId);
                socket.disconnect(true);
            }
        }, this.HEARTBEAT_TIMEOUT);

        this.socketTimeouts.set(socketId, timeout);
    }

    stopHeartbeat(): void {
        if (!this.heartbeatInterval) {
            return;
        }

        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        this.socketMissedHeartbeats.clear();

        this.socketTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.socketTimeouts.clear();

        logger.log('Startup', 'Complete', '[Heartbeat] Stopped');
    }
}

export const socketService = new SocketService();
