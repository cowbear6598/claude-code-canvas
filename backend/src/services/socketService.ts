import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/index.js';
import {
  WebSocketResponseEvents,
  ConnectionReadyPayload,
  PodCreatedPayload,
  PodListResultPayload,
  PodGetResultPayload,
  PodDeletedPayload,
  PodGitCloneProgressPayload,
  PodGitCloneResultPayload,
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodErrorPayload,
} from '../types/index.js';

class SocketService {
  private io: SocketIOServer | null = null;
  private socketToPodRooms: Map<string, Set<string>> = new Map();

  initialize(httpServer: HttpServer): void {
    if (this.io) {
      console.log('[Socket.io] Already initialized');
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
      },
    });

    console.log('[Socket.io] Server initialized');
  }

  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io not initialized. Call initialize() first.');
    }
    return this.io;
  }

  emitToPod(podId: string, event: string, payload: unknown): void {
    if (!this.io) {
      console.warn('[Socket.io] Cannot emit - not initialized');
      return;
    }

    const roomName = `pod:${podId}`;
    this.io.to(roomName).emit(event, payload);
    console.log(`[Socket.io] Emitted ${event} to room ${roomName}`);
  }

  private emitToSocket(socketId: string, event: string, payload: unknown): void {
    if (!this.io) {
      console.warn('[Socket.io] Cannot emit - not initialized');
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn(`[Socket.io] Socket ${socketId} not found`);
      return;
    }

    socket.emit(event, payload);
  }

  emitConnectionReady(socketId: string, payload: ConnectionReadyPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.CONNECTION_READY, payload);
  }

  emitPodCreated(socketId: string, payload: PodCreatedPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_CREATED, payload);
  }

  emitPodListResult(socketId: string, payload: PodListResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_LIST_RESULT, payload);
  }

  emitPodGetResult(socketId: string, payload: PodGetResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_GET_RESULT, payload);
  }

  emitPodDeleted(socketId: string, payload: PodDeletedPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_DELETED, payload);
  }

  emitPodDeletedBroadcast(podId: string, payload: PodDeletedPayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_DELETED, payload);
  }

  emitGitCloneProgress(podId: string, payload: PodGitCloneProgressPayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, payload);
  }

  emitGitCloneResult(socketId: string, payload: PodGitCloneResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_GIT_CLONE_RESULT, payload);
  }

  emitChatMessage(podId: string, payload: PodChatMessagePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_MESSAGE, payload);
  }

  emitChatToolUse(podId: string, payload: PodChatToolUsePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_TOOL_USE, payload);
  }

  emitChatToolResult(podId: string, payload: PodChatToolResultPayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, payload);
  }

  emitChatComplete(podId: string, payload: PodChatCompletePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_COMPLETE, payload);
  }

  emitError(socketId: string, payload: PodErrorPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_ERROR, payload);
  }

  joinPodRoom(socketId: string, podId: string): void {
    if (!this.io) {
      console.warn('[Socket.io] Cannot join room - not initialized');
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn(`[Socket.io] Socket ${socketId} not found`);
      return;
    }

    const roomName = `pod:${podId}`;
    socket.join(roomName);

    if (!this.socketToPodRooms.has(socketId)) {
      this.socketToPodRooms.set(socketId, new Set());
    }
    this.socketToPodRooms.get(socketId)!.add(podId);

    console.log(`[Socket.io] Socket ${socketId} joined room ${roomName}`);
  }

  leavePodRoom(socketId: string, podId: string): void {
    if (!this.io) {
      console.warn('[Socket.io] Cannot leave room - not initialized');
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn(`[Socket.io] Socket ${socketId} not found`);
      return;
    }

    const roomName = `pod:${podId}`;
    socket.leave(roomName);

    const rooms = this.socketToPodRooms.get(socketId);
    if (!rooms) {
      console.log(`[Socket.io] Socket ${socketId} left room ${roomName}`);
      return;
    }

    rooms.delete(podId);
    if (rooms.size === 0) {
      this.socketToPodRooms.delete(socketId);
    }

    console.log(`[Socket.io] Socket ${socketId} left room ${roomName}`);
  }

  cleanupSocket(socketId: string): void {
    this.socketToPodRooms.get(socketId)?.forEach((podId) => {
      this.leavePodRoom(socketId, podId);
    });
    this.socketToPodRooms.delete(socketId);
    console.log(`[Socket.io] Cleaned up socket ${socketId}`);
  }
}

export const socketService = new SocketService();
