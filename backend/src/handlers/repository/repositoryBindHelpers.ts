import { WebSocketResponseEvents } from '../../schemas';
import { messageStore } from '../../services/messageStore.js';
import { canvasStore } from '../../services/canvasStore.js';
import { socketService } from '../../services/socketService.js';
import { logger } from '../../utils/logger.js';

export async function clearPodMessages(connectionId: string, podId: string): Promise<void> {
	try {
		const canvasId = canvasStore.getActiveCanvas(connectionId);
		if (!canvasId) {
			logger.error('Repository', 'Error', `No active canvas for clearing messages for Pod ${podId}`);
			return;
		}
		await messageStore.clearMessagesWithPersistence(canvasId, podId);
		socketService.emitToConnection(connectionId, WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
	} catch (error) {
		logger.error('Repository', 'Error', `Failed to clear messages for Pod ${podId}`, error);
	}
}
