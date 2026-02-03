import { Socket } from 'socket.io';
import { socketService } from './socketService.js';
import { canvasStore } from './canvasStore.js';
import { registerAllHandlers } from '../handlers/index.js';
import { WebSocketRequestEvents, WebSocketResponseEvents } from '../schemas/index.js';
import type {
  PodJoinPayload,
  PodJoinBatchPayload,
  PodLeavePayload,
} from '../schemas/index.js';
import { isValidPodId } from '../utils/payloadUtils.js';

export function setupSocketHandlers(socket: Socket): void {
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
  });

  socket.on(WebSocketRequestEvents.POD_JOIN_BATCH, (data: PodJoinBatchPayload) => {
    const { podIds } = data;

    if (!Array.isArray(podIds)) {
      socket.emit('error', { message: 'Invalid podIds: must be an array' });
      return;
    }

    const joinedPodIds: string[] = [];
    const failedPodIds: string[] = [];

    podIds.forEach((podId) => {
      if (!isValidPodId(podId)) {
        failedPodIds.push(podId);
        return;
      }

      socketService.joinPodRoom(socket.id, podId);
      joinedPodIds.push(podId);
    });

    socket.emit(WebSocketResponseEvents.POD_JOINED_BATCH, { joinedPodIds, failedPodIds });
  });

  socket.on(WebSocketRequestEvents.POD_LEAVE, (data: PodLeavePayload) => {
    const { podId } = data;

    if (!isValidPodId(podId)) {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    socketService.leavePodRoom(socket.id, podId);

    socket.emit(WebSocketResponseEvents.POD_LEFT, { podId });
  });

  socket.on('disconnect', () => {
    socketService.cleanupSocket(socket.id);
    canvasStore.removeSocket(socket.id);
  });
}
