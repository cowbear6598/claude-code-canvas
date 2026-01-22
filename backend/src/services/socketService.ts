// Socket Service
// Manages Socket.io server and room-based event emission

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
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

  /**
   * Initialize Socket.io server
   * @param httpServer HTTP server instance to attach Socket.io to
   */
  initialize(httpServer: HttpServer): void {
    if (this.io) {
      console.log('[Socket.io] Already initialized');
      return;
    }

    // Create Socket.io server with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
      },
    });

    console.log('[Socket.io] Server initialized');
  }

  /**
   * Get Socket.io server instance
   */
  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io not initialized. Call initialize() first.');
    }
    return this.io;
  }

  /**
   * Emit event to a specific Pod room
   * All clients that joined this Pod's room will receive the event
   * @param podId Pod identifier (room name)
   * @param event Event name
   * @param payload Event data
   */
  emitToPod(podId: string, event: string, payload: unknown): void {
    if (!this.io) {
      console.warn('[Socket.io] Cannot emit - not initialized');
      return;
    }

    const roomName = `pod:${podId}`;
    this.io.to(roomName).emit(event, payload);
    console.log(`[Socket.io] Emitted ${event} to room ${roomName}`);
  }

  /**
   * Emit event to a specific socket
   * @param socketId Socket identifier
   * @param event Event name
   * @param payload Event data
   */
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

  // ============================================================================
  // Typed Emit Methods (Server -> Client Events)
  // ============================================================================

  /**
   * Emit connection ready event
   */
  emitConnectionReady(socketId: string, payload: ConnectionReadyPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.CONNECTION_READY, payload);
  }

  /**
   * Emit pod created result
   */
  emitPodCreated(socketId: string, payload: PodCreatedPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_CREATED, payload);
  }

  /**
   * Emit pod list result
   */
  emitPodListResult(socketId: string, payload: PodListResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_LIST_RESULT, payload);
  }

  /**
   * Emit pod get result
   */
  emitPodGetResult(socketId: string, payload: PodGetResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_GET_RESULT, payload);
  }

  /**
   * Emit pod deleted result
   */
  emitPodDeleted(socketId: string, payload: PodDeletedPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_DELETED, payload);
  }

  /**
   * Emit git clone progress (to Pod room)
   */
  emitGitCloneProgress(podId: string, payload: PodGitCloneProgressPayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, payload);
  }

  /**
   * Emit git clone result
   */
  emitGitCloneResult(socketId: string, payload: PodGitCloneResultPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_GIT_CLONE_RESULT, payload);
  }

  /**
   * Emit chat message (to Pod room)
   */
  emitChatMessage(podId: string, payload: PodChatMessagePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_MESSAGE, payload);
  }

  /**
   * Emit chat tool use (to Pod room)
   */
  emitChatToolUse(podId: string, payload: PodChatToolUsePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_TOOL_USE, payload);
  }

  /**
   * Emit chat tool result (to Pod room)
   */
  emitChatToolResult(podId: string, payload: PodChatToolResultPayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, payload);
  }

  /**
   * Emit chat complete (to Pod room)
   */
  emitChatComplete(podId: string, payload: PodChatCompletePayload): void {
    this.emitToPod(podId, WebSocketResponseEvents.POD_CHAT_COMPLETE, payload);
  }

  /**
   * Emit error (can be to socket or Pod room)
   */
  emitError(socketId: string, payload: PodErrorPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.POD_ERROR, payload);
  }

  // ============================================================================
  // Room Management
  // ============================================================================

  /**
   * Add a socket to a Pod room
   * @param socketId Socket identifier
   * @param podId Pod identifier
   */
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

    // Track which rooms this socket is in
    if (!this.socketToPodRooms.has(socketId)) {
      this.socketToPodRooms.set(socketId, new Set());
    }
    this.socketToPodRooms.get(socketId)!.add(podId);

    console.log(`[Socket.io] Socket ${socketId} joined room ${roomName}`);
  }

  /**
   * Remove a socket from a Pod room
   * @param socketId Socket identifier
   * @param podId Pod identifier
   */
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

    // Update tracking
    const rooms = this.socketToPodRooms.get(socketId);
    if (rooms) {
      rooms.delete(podId);
      if (rooms.size === 0) {
        this.socketToPodRooms.delete(socketId);
      }
    }

    console.log(`[Socket.io] Socket ${socketId} left room ${roomName}`);
  }

  /**
   * Clean up a socket's room memberships
   * Called when a socket disconnects
   * @param socketId Socket identifier
   */
  cleanupSocket(socketId: string): void {
    const rooms = this.socketToPodRooms.get(socketId);
    if (rooms) {
      rooms.forEach((podId) => {
        this.leavePodRoom(socketId, podId);
      });
    }
    this.socketToPodRooms.delete(socketId);
    console.log(`[Socket.io] Cleaned up socket ${socketId}`);
  }
}

// Export singleton instance
export const socketService = new SocketService();
