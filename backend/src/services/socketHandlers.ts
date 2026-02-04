import { Socket } from 'socket.io';
import { socketService } from './socketService.js';
import { canvasStore } from './canvasStore.js';
import { registerAllHandlers } from '../handlers/index.js';

export function setupSocketHandlers(socket: Socket): void {
  socketService.emitConnectionReady(socket.id, { socketId: socket.id });

  registerAllHandlers(socket);

  socket.on('disconnect', () => {
    socketService.cleanupSocket(socket.id);
    canvasStore.removeSocket(socket.id);
  });
}
