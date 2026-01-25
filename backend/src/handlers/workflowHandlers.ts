// Workflow WebSocket Handlers
// Handles workflow-related operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type WorkflowGetDownstreamPodsPayload,
  type WorkflowGetDownstreamPodsResultPayload,
  type WorkflowClearPayload,
  type WorkflowClearResultPayload,
} from '../types/index.js';
import { workflowClearService } from '../services/workflowClearService.js';
import { podStore } from '../services/podStore.js';
import {
  emitSuccess,
  emitError,
  tryValidatePayload,
} from '../utils/websocketResponse.js';

/**
 * Handle workflow get downstream PODs request
 */
export async function handleWorkflowGetDownstreamPods(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<WorkflowGetDownstreamPodsPayload>(payload, [
    'requestId',
    'sourcePodId',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Workflow] Failed to get downstream PODs: ${validation.error}`);
    return;
  }

  const { requestId, sourcePodId } = validation.data!;

  // Check if source POD exists
  const sourcePod = podStore.getById(sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
      `Source POD not found: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Workflow] Source POD not found: ${sourcePodId}`);
    return;
  }

  try {
    // Get downstream PODs
    const pods = workflowClearService.getDownstreamPods(sourcePodId);

    // Emit success response
    const response: WorkflowGetDownstreamPodsResultPayload = {
      requestId,
      success: true,
      pods,
    };

    emitSuccess(socket, WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT, response);

    console.log(`[Workflow] Retrieved ${pods.length} downstream PODs from ${sourcePodId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
      errorMessage,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Workflow] Error getting downstream PODs: ${errorMessage}`);
  }
}

/**
 * Handle workflow clear request
 */
export async function handleWorkflowClear(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<WorkflowClearPayload>(payload, [
    'requestId',
    'sourcePodId',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Workflow] Failed to clear workflow: ${validation.error}`);
    return;
  }

  const { requestId, sourcePodId } = validation.data!;

  // Check if source POD exists
  const sourcePod = podStore.getById(sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
      `Source POD not found: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Workflow] Source POD not found: ${sourcePodId}`);
    return;
  }

  try {
    // Clear workflow
    const result = await workflowClearService.clearWorkflow(sourcePodId);

    if (result.success) {
      // Emit success response
      const response: WorkflowClearResultPayload = {
        requestId,
        success: true,
        clearedPodIds: result.clearedPodIds,
        clearedPodNames: result.clearedPodNames,
      };

      emitSuccess(socket, WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT, response);

      console.log(
        `[Workflow] Cleared ${result.clearedPodIds.length} PODs: ${result.clearedPodNames.join(', ')}`
      );
    } else {
      // Emit error response
      emitError(
        socket,
        WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        result.error || 'Unknown error occurred during workflow clear',
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );

      console.error(`[Workflow] Failed to clear workflow: ${result.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    emitError(
      socket,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
      errorMessage,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Workflow] Error clearing workflow: ${errorMessage}`);
  }
}
