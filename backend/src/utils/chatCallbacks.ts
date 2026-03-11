import { socketService } from '../services/socketService.js';
import { workflowExecutionService } from '../services/workflow/index.js';
import { logger } from './logger.js';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type { PodChatAbortedPayload } from '../types/index.js';

export const onChatComplete = async (canvasId: string, podId: string): Promise<void> => {
  workflowExecutionService.checkAndTriggerWorkflows(canvasId, podId).catch((error) => {
    logger.error('Workflow', 'Error', `檢查 Pod「${podId}」自動觸發 Workflow 失敗`, error);
  });
};

export function onChatAborted(canvasId: string, podId: string, messageId: string, podName: string): void {
  const abortedPayload: PodChatAbortedPayload = { canvasId, podId, messageId };
  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_CHAT_ABORTED, abortedPayload);
  logger.log('Chat', 'Abort', `Pod「${podName}」對話已中斷`);
}
