import { v4 as uuidv4 } from 'uuid';
import { socketService } from '../socketService.js';
import { WebSocketResponseEvents } from '../../schemas/index.js';
import type {
  WorkflowAutoTriggeredPayload,
  WorkflowPendingPayload,
  WorkflowSourcesMergedPayload,
} from '../../types/index.js';

class WorkflowEventEmitter {
  emitWorkflowComplete(
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    success: boolean,
    error?: string
  ): void {
    const payload = {
      requestId: uuidv4(),
      connectionId,
      targetPodId,
      success,
      ...(error && { error }),
    };

    socketService.emitToPod(sourcePodId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
  }

  emitWorkflowTriggered(
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    transferredContent: string,
    isSummarized: boolean
  ): void {
    const payload = {
      requestId: uuidv4(),
      success: true,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    socketService.emitToPod(sourcePodId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
  }

  emitWorkflowAutoTriggered(
    sourcePodId: string,
    targetPodId: string,
    payload: WorkflowAutoTriggeredPayload
  ): void {
    socketService.emitToPod(sourcePodId, WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, payload);
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, payload);
  }

  emitWorkflowPending(targetPodId: string, payload: WorkflowPendingPayload): void {
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_PENDING, payload);
  }

  emitWorkflowSourcesMerged(
    targetPodId: string,
    sourcePodIds: string[],
    payload: WorkflowSourcesMergedPayload
  ): void {
    socketService.emitToPod(targetPodId, WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED, payload);

    for (const sourceId of sourcePodIds) {
      socketService.emitToPod(sourceId, WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED, payload);
    }
  }
}

export const workflowEventEmitter = new WorkflowEventEmitter();
