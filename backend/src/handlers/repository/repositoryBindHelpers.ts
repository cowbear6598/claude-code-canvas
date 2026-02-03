import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../../schemas/index.js';
import { messageStore } from '../../services/messageStore.js';
import { canvasStore } from '../../services/canvasStore.js';
import { logger } from '../../utils/logger.js';

export async function clearPodMessages(socket: Socket, podId: string): Promise<void> {
  try {
    const canvasId = canvasStore.getActiveCanvas(socket.id);
    if (!canvasId) {
      logger.error('Repository', 'Error', `No active canvas for clearing messages for Pod ${podId}`);
      return;
    }
    await messageStore.clearMessagesWithPersistence(canvasId, podId);
    socket.emit(WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
  } catch (error) {
    logger.error('Repository', 'Error', `Failed to clear messages for Pod ${podId}`, error);
  }
}
