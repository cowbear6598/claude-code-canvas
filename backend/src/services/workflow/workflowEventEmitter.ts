import { v4 as uuidv4 } from 'uuid';
import { socketService } from '../socketService.js';
import { WebSocketResponseEvents } from '../../schemas';
import type {
  WorkflowAutoTriggeredPayload,
  WorkflowPendingPayload,
  WorkflowSourcesMergedPayload,
} from '../../types';

class WorkflowEventEmitter {
  emitWorkflowComplete(
    canvasId: string,
    connectionId: string,
    _sourcePodId: string,
    targetPodId: string,
    success: boolean,
    error?: string
  ): void {
    const payload = {
      canvasId,
      requestId: uuidv4(),
      connectionId,
      targetPodId,
      success,
      ...(error && { error }),
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_COMPLETE, payload);
  }

  emitWorkflowTriggered(
    canvasId: string,
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    transferredContent: string,
    isSummarized: boolean
  ): void {
    const payload = {
      canvasId,
      requestId: uuidv4(),
      success: true,
      connectionId,
      sourcePodId,
      targetPodId,
      transferredContent,
      isSummarized,
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_TRIGGERED, payload);
  }

  emitWorkflowAutoTriggered(
    canvasId: string,
    _sourcePodId: string,
    _targetPodId: string,
    payload: WorkflowAutoTriggeredPayload
  ): void {
    const fullPayload = {
      ...payload,
      canvasId,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, fullPayload);
  }

  emitWorkflowPending(canvasId: string, _targetPodId: string, payload: WorkflowPendingPayload): void {
    const fullPayload = {
      ...payload,
      canvasId,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_PENDING, fullPayload);
  }

  emitWorkflowSourcesMerged(
    canvasId: string,
    _targetPodId: string,
    _sourcePodIds: string[],
    payload: WorkflowSourcesMergedPayload
  ): void {
    const fullPayload = {
      ...payload,
      canvasId,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED, fullPayload);
  }
}

export const workflowEventEmitter = new WorkflowEventEmitter();
