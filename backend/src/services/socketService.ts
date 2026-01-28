import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
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
  WorkflowTriggeredPayload,
  WorkflowCompletePayload,
  WorkflowErrorPayload,
} from '../types/index.js';

class SocketService {
  private io: SocketIOServer | null = null;
  private socketToPodRooms: Map<string, Set<string>> = new Map();

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
    });

    logger.log('Startup', 'Complete', '[Socket.io] Server initialized');
  }

  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io 尚未初始化。請先呼叫 initialize()');
    }
    return this.io;
  }

  emitToPod(podId: string, event: string, payload: unknown): void {
    if (!this.io) {
      return;
    }

    const roomName = `pod:${podId}`;
    this.io.to(roomName).emit(event, payload);
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

  emitWorkflowTriggered(socketId: string, payload: WorkflowTriggeredPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
  }

  emitWorkflowComplete(socketId: string, payload: WorkflowCompletePayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
  }

  emitWorkflowError(socketId: string, payload: WorkflowErrorPayload): void {
    this.emitToSocket(socketId, WebSocketResponseEvents.WORKFLOW_ERROR, payload);
  }

  joinPodRoom(socketId: string, podId: string): void {
    if (!this.io) {
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      return;
    }

    const roomName = `pod:${podId}`;
    socket.join(roomName);

    if (!this.socketToPodRooms.has(socketId)) {
      this.socketToPodRooms.set(socketId, new Set());
    }
    this.socketToPodRooms.get(socketId)!.add(podId);
  }

  leavePodRoom(socketId: string, podId: string): void {
    if (!this.io) {
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      return;
    }

    const roomName = `pod:${podId}`;
    socket.leave(roomName);

    const rooms = this.socketToPodRooms.get(socketId);
    if (!rooms) {
      return;
    }

    rooms.delete(podId);
    if (rooms.size === 0) {
      this.socketToPodRooms.delete(socketId);
    }
  }

  cleanupSocket(socketId: string): void {
    this.socketToPodRooms.get(socketId)?.forEach((podId) => {
      this.leavePodRoom(socketId, podId);
    });
    this.socketToPodRooms.delete(socketId);
  }
}

export const socketService = new SocketService();
