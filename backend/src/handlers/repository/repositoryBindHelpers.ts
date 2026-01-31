import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../../types/index.js';
import { messageStore } from '../../services/messageStore.js';
import { logger } from '../../utils/logger.js';

export async function clearPodMessages(socket: Socket, podId: string): Promise<void> {
  try {
    await messageStore.clearMessagesWithPersistence(podId);
    socket.emit(WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
  } catch (error) {
    logger.error('Repository', 'Error', `Failed to clear messages for Pod ${podId}`, error);
  }
}
