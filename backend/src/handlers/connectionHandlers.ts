import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  ConnectionCreatedPayload,
  ConnectionListResultPayload,
  ConnectionDeletedPayload,
  ConnectionUpdatedPayload,
  PodScheduleSetPayload,
} from '../types/index.js';
import type {
  ConnectionCreatePayload,
  ConnectionListPayload,
  ConnectionDeletePayload,
  ConnectionUpdatePayload,
} from '../schemas/index.js';
import { connectionStore } from '../services/connectionStore.js';
import { podStore } from '../services/podStore.js';
import { workflowStateService } from '../services/workflow/index.js';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { withCanvasId } from '../utils/handlerHelpers.js';

export const handleConnectionCreate = withCanvasId<ConnectionCreatePayload>(
  WebSocketResponseEvents.CONNECTION_CREATED,
  async (socket: Socket, canvasId: string, payload: ConnectionCreatePayload, requestId: string): Promise<void> => {
    const { sourcePodId, sourceAnchor, targetPodId, targetAnchor } = payload;

  const sourcePod = podStore.getById(canvasId, sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_CREATED,
      `來源 Pod 找不到: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const targetPod = podStore.getById(canvasId, targetPodId);
  if (!targetPod) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_CREATED,
      `目標 Pod 找不到: ${targetPodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const connection = connectionStore.create(canvasId, {
    sourcePodId,
    sourceAnchor,
    targetPodId,
    targetAnchor,
  });

  const response: ConnectionCreatedPayload = {
    requestId,
    canvasId,
    success: true,
    connection,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_CREATED, response);

    if (targetPod.schedule) {
      const updatedPod = podStore.update(canvasId, targetPodId, { schedule: null });

      if (updatedPod) {
        const podSchedulePayload: PodScheduleSetPayload = {
          requestId: '',
          canvasId,
          success: true,
          pod: updatedPod,
        };
        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_SCHEDULE_SET, podSchedulePayload);

        logger.log('Connection', 'Create', `Cleared schedule for target Pod ${targetPodId} (now downstream)`);
      }
    }

    logger.log('Connection', 'Create', `Created connection ${connection.id} (${sourcePodId} -> ${targetPodId})`);
  }
);

export const handleConnectionList = withCanvasId<ConnectionListPayload>(
  WebSocketResponseEvents.CONNECTION_LIST_RESULT,
  async (socket: Socket, canvasId: string, _: ConnectionListPayload, requestId: string): Promise<void> => {

  const connections = connectionStore.list(canvasId);

    const response: ConnectionListResultPayload = {
      requestId,
      success: true,
      connections,
    };

    emitSuccess(socket, WebSocketResponseEvents.CONNECTION_LIST_RESULT, response);
  }
);

export const handleConnectionDelete = withCanvasId<ConnectionDeletePayload>(
  WebSocketResponseEvents.CONNECTION_DELETED,
  async (socket: Socket, canvasId: string, payload: ConnectionDeletePayload, requestId: string): Promise<void> => {
    const { connectionId } = payload;

  const connection = connectionStore.getById(canvasId, connectionId);
  if (!connection) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_DELETED,
      `Connection 找不到: ${connectionId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  workflowStateService.handleConnectionDeletion(canvasId, connectionId);

  const deleted = connectionStore.delete(canvasId, connectionId);

  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_DELETED,
      `Failed to delete connection from store: ${connectionId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: ConnectionDeletedPayload = {
    requestId,
    canvasId,
    success: true,
    connectionId,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_DELETED, response);

  logger.log('Connection', 'Delete', `Deleted connection ${connectionId}`);
  }
);

export const handleConnectionUpdate = withCanvasId<ConnectionUpdatePayload>(
  WebSocketResponseEvents.CONNECTION_UPDATED,
  async (socket: Socket, canvasId: string, payload: ConnectionUpdatePayload, requestId: string): Promise<void> => {
    const { connectionId, autoTrigger } = payload;

  const connection = connectionStore.getById(canvasId, connectionId);
  if (!connection) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_UPDATED,
      `Connection 找不到: ${connectionId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const updates: Partial<{ autoTrigger: boolean }> = {};
  if (autoTrigger !== undefined) {
    updates.autoTrigger = autoTrigger;
  }

  const updatedConnection = connectionStore.update(canvasId, connectionId, updates);

  if (!updatedConnection) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_UPDATED,
      `Failed to update connection: ${connectionId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: ConnectionUpdatedPayload = {
    requestId,
    canvasId,
    success: true,
    connection: updatedConnection,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_UPDATED, response);
  }
);
