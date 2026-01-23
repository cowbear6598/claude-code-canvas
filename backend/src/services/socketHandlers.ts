import { Socket } from 'socket.io';
import { socketService } from './socketService.js';
import { registerAllHandlers } from '../handlers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  PodJoinPayload,
  PodLeavePayload,
} from '../types/index.js';
import { isValidPodId } from '../utils/payloadUtils.js';

export function setupSocketHandlers(socket: Socket): void {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socketService.emitConnectionReady(socket.id, { socketId: socket.id });

  registerAllHandlers(socket);

  socket.on(WebSocketRequestEvents.POD_JOIN, (data: PodJoinPayload) => {
    const { podId } = data;

    if (!isValidPodId(podId)) {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    socketService.joinPodRoom(socket.id, podId);

    socket.emit(WebSocketResponseEvents.POD_JOINED, { podId });
    console.log(`[Socket.io] Client ${socket.id} joined Pod ${podId}`);
  });

  socket.on(WebSocketRequestEvents.POD_LEAVE, (data: PodLeavePayload) => {
    const { podId } = data;

    if (!isValidPodId(podId)) {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    socketService.leavePodRoom(socket.id, podId);

    socket.emit(WebSocketResponseEvents.POD_LEFT, { podId });
    console.log(`[Socket.io] Client ${socket.id} left Pod ${podId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);

    socketService.cleanupSocket(socket.id);
  });
}
