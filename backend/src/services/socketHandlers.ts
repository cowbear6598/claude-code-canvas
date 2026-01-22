// Socket Event Handlers
// Handles Socket.io connection events and room management

import { Socket } from 'socket.io';
import { socketService } from './socketService.js';
import { registerAllHandlers } from '../handlers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  PodJoinPayload,
  PodLeavePayload,
} from '../types/index.js';

/**
 * Setup Socket.io event handlers for a connected socket
 * @param socket Socket.io socket instance
 */
export function setupSocketHandlers(socket: Socket): void {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Emit connection ready event
  socketService.emitConnectionReady(socket.id, { socketId: socket.id });

  // Register all WebSocket handlers (pod, git, chat)
  registerAllHandlers(socket);

  // Handle pod:join event
  socket.on(WebSocketRequestEvents.POD_JOIN, (data: PodJoinPayload) => {
    const { podId } = data;

    if (!podId || typeof podId !== 'string') {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    // Join the Pod room
    socketService.joinPodRoom(socket.id, podId);

    // Send confirmation
    socket.emit(WebSocketResponseEvents.POD_JOINED, { podId });
    console.log(`[Socket.io] Client ${socket.id} joined Pod ${podId}`);
  });

  // Handle pod:leave event
  socket.on(WebSocketRequestEvents.POD_LEAVE, (data: PodLeavePayload) => {
    const { podId } = data;

    if (!podId || typeof podId !== 'string') {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    // Leave the Pod room
    socketService.leavePodRoom(socket.id, podId);

    // Send confirmation
    socket.emit(WebSocketResponseEvents.POD_LEFT, { podId });
    console.log(`[Socket.io] Client ${socket.id} left Pod ${podId}`);
  });

  // DEPRECATED: Keep for backward compatibility
  // Handle join:pod event (deprecated, use pod:join instead)
  socket.on('join:pod', (data: { podId: string }) => {
    console.warn('[Socket.io] DEPRECATED: "join:pod" event is deprecated, use "pod:join" instead');
    const { podId } = data;

    if (!podId || typeof podId !== 'string') {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    socketService.joinPodRoom(socket.id, podId);
    socket.emit('joined:pod', { podId });
    console.log(`[Socket.io] Client ${socket.id} joined Pod ${podId} (deprecated event)`);
  });

  // DEPRECATED: Keep for backward compatibility
  // Handle leave:pod event (deprecated, use pod:leave instead)
  socket.on('leave:pod', (data: { podId: string }) => {
    console.warn('[Socket.io] DEPRECATED: "leave:pod" event is deprecated, use "pod:leave" instead');
    const { podId } = data;

    if (!podId || typeof podId !== 'string') {
      socket.emit('error', { message: 'Invalid podId' });
      return;
    }

    socketService.leavePodRoom(socket.id, podId);
    socket.emit('left:pod', { podId });
    console.log(`[Socket.io] Client ${socket.id} left Pod ${podId} (deprecated event)`);
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);

    // Clean up all room memberships
    socketService.cleanupSocket(socket.id);
  });
}
