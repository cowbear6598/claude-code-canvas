import { v4 as uuidv4 } from 'uuid';
import { socketService } from '../socketService.js';
import { WebSocketResponseEvents } from '../../schemas/index.js';
import type {
  WorkflowAutoTriggeredPayload,
  WorkflowPendingPayload,
  WorkflowSourcesMergedPayload,
  WorkflowAiDecidePendingPayload,
  WorkflowAiDecideResultPayload,
  WorkflowAiDecideErrorPayload,
  WorkflowAiDecideClearPayload,
  WorkflowDirectTriggeredPayload,
  WorkflowDirectWaitingPayload,
  WorkflowQueuedPayload,
  WorkflowQueueProcessedPayload,
  WorkflowDirectMergedPayload,
} from '../../types/index.js';

class WorkflowEventEmitter {
  emitWorkflowComplete(
    canvasId: string,
    connectionId: string,
    _sourcePodId: string,
    targetPodId: string,
    success: boolean,
    error?: string,
    triggerMode?: 'auto' | 'ai-decide' | 'direct'
  ): void {
    const payload = {
      canvasId,
      requestId: uuidv4(),
      connectionId,
      targetPodId,
      success,
      ...(error && { error }),
      ...(triggerMode && { triggerMode }),
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

  emitAiDecidePending(canvasId: string, connectionIds: string[], sourcePodId: string): void {
    const payload: WorkflowAiDecidePendingPayload = {
      canvasId,
      connectionIds,
      sourcePodId,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AI_DECIDE_PENDING, payload);
  }

  emitAiDecideResult(
    canvasId: string,
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    shouldTrigger: boolean,
    reason: string
  ): void {
    const payload: WorkflowAiDecideResultPayload = {
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      shouldTrigger,
      reason,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AI_DECIDE_RESULT, payload);
  }

  emitAiDecideError(
    canvasId: string,
    connectionId: string,
    sourcePodId: string,
    targetPodId: string,
    error: string
  ): void {
    const payload: WorkflowAiDecideErrorPayload = {
      canvasId,
      connectionId,
      sourcePodId,
      targetPodId,
      error,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AI_DECIDE_ERROR, payload);
  }

  emitAiDecideClear(canvasId: string, connectionIds: string[]): void {
    const payload: WorkflowAiDecideClearPayload = {
      canvasId,
      connectionIds,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AI_DECIDE_CLEAR, payload);
  }

  emitDirectTriggered(canvasId: string, payload: WorkflowDirectTriggeredPayload): void {
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_DIRECT_TRIGGERED, payload);
  }

  emitDirectWaiting(canvasId: string, payload: WorkflowDirectWaitingPayload): void {
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_DIRECT_WAITING, payload);
  }

  emitWorkflowQueued(canvasId: string, payload: WorkflowQueuedPayload): void {
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_QUEUED, payload);
  }

  emitWorkflowQueueProcessed(canvasId: string, payload: WorkflowQueueProcessedPayload): void {
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_QUEUE_PROCESSED, payload);
  }

  emitDirectCountdown(canvasId: string, targetPodId: string, remainingSeconds: number, readySourcePodIds: string[]): void {
    const payload = {
      canvasId,
      targetPodId,
      remainingSeconds,
      readySourcePodIds,
    };
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_DIRECT_COUNTDOWN, payload);
  }

  emitDirectMerged(canvasId: string, payload: WorkflowDirectMergedPayload): void {
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_DIRECT_MERGED, payload);
  }
}

export const workflowEventEmitter = new WorkflowEventEmitter();
