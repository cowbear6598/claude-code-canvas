import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type WorkflowGetDownstreamPodsResultPayload,
  type WorkflowClearResultPayload,
  type BroadcastWorkflowClearResultPayload,
} from '../types/index.js';
import type {
  WorkflowGetDownstreamPodsPayload,
  WorkflowClearPayload,
} from '../schemas/index.js';
import { workflowClearService } from '../services/workflowClearService.js';
import { podStore } from '../services/podStore.js';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { getCanvasId } from '../utils/handlerHelpers.js';

export async function handleWorkflowGetDownstreamPods(
  socket: Socket,
  payload: WorkflowGetDownstreamPodsPayload,
  requestId: string
): Promise<void> {
  const { sourcePodId } = payload;

  const canvasId = getCanvasId(socket, WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT, requestId);
  if (!canvasId) {
    return;
  }

  const sourcePod = podStore.getById(canvasId, sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
      `找不到來源 Pod: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const pods = workflowClearService.getDownstreamPods(canvasId, sourcePodId);

  const response: WorkflowGetDownstreamPodsResultPayload = {
    requestId,
    success: true,
    pods,
  };

  emitSuccess(socket, WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT, response);
}

export async function handleWorkflowClear(
  socket: Socket,
  payload: WorkflowClearPayload,
  requestId: string
): Promise<void> {
  const { sourcePodId } = payload;

  const canvasId = getCanvasId(socket, WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT, requestId);
  if (!canvasId) {
    return;
  }

  const sourcePod = podStore.getById(canvasId, sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
      `找不到來源 Pod: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const result = await workflowClearService.clearWorkflow(canvasId, sourcePodId);

  if (!result.success) {
    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
      result.error || 'Unknown error occurred during workflow clear',
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: WorkflowClearResultPayload = {
    requestId,
    success: true,
    clearedPodIds: result.clearedPodIds,
    clearedPodNames: result.clearedPodNames,
  };

  emitSuccess(socket, WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT, response);

  const broadcastPayload: BroadcastWorkflowClearResultPayload = {
    canvasId,
    clearedPodIds: result.clearedPodIds,
  };
  socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_WORKFLOW_CLEAR_RESULT, broadcastPayload);

  logger.log(
    'Workflow',
    'Complete',
    `Cleared ${result.clearedPodIds.length} PODs: ${result.clearedPodNames.join(', ')}`
  );
}
