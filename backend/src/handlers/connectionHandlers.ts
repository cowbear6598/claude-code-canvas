import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type ConnectionCreatedPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletedPayload,
  type ConnectionUpdatedPayload,
  type BroadcastConnectionCreatedPayload,
  type BroadcastConnectionUpdatedPayload,
  type BroadcastConnectionDeletedPayload,
} from '../types/index.js';
import type {
  ConnectionCreatePayload,
  ConnectionListPayload,
  ConnectionDeletePayload,
  ConnectionUpdatePayload,
} from '../schemas/index.js';
import { connectionStore } from '../services/connectionStore.js';
import { podStore } from '../services/podStore.js';
import { triggerStore } from '../services/triggerStore.js';
import { workflowStateService } from '../services/workflow/index.js';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { withCanvasId } from '../utils/handlerHelpers.js';

export const handleConnectionCreate = withCanvasId<ConnectionCreatePayload>(
  WebSocketResponseEvents.CONNECTION_CREATED,
  async (socket: Socket, canvasId: string, payload: ConnectionCreatePayload, requestId: string): Promise<void> => {
    const { sourceType, sourcePodId, sourceTriggerId, sourceAnchor, targetPodId, targetAnchor } = payload;

  if (sourceType === 'pod') {
    const sourcePod = podStore.getById(canvasId, sourcePodId!);
    if (!sourcePod) {
      emitError(
        socket,
        WebSocketResponseEvents.CONNECTION_CREATED,
        `Source Pod not found: ${sourcePodId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }
  } else if (sourceType === 'trigger') {
    const sourceTrigger = triggerStore.getById(canvasId, sourceTriggerId!);
    if (!sourceTrigger) {
      emitError(
        socket,
        WebSocketResponseEvents.CONNECTION_CREATED,
        `Source Trigger not found: ${sourceTriggerId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }
  }

  const targetPod = podStore.getById(canvasId, targetPodId);
  if (!targetPod) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_CREATED,
      `Target Pod not found: ${targetPodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const connection = connectionStore.create(canvasId, {
    sourceType,
    sourcePodId: sourcePodId!,
    sourceTriggerId,
    sourceAnchor,
    targetPodId,
    targetAnchor,
  });

  const response: ConnectionCreatedPayload = {
    requestId,
    success: true,
    connection,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_CREATED, response);

  const broadcastPayload: BroadcastConnectionCreatedPayload = {
    canvasId,
    connection,
  };
  socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_CONNECTION_CREATED, broadcastPayload);

    const sourceId = sourceType === 'trigger' ? sourceTriggerId : sourcePodId;
    logger.log('Connection', 'Create', `Created connection ${connection.id} (${sourceType}:${sourceId} -> ${targetPodId})`);
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
      `Connection not found: ${connectionId}`,
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
    success: true,
    connectionId,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_DELETED, response);

  const broadcastPayload: BroadcastConnectionDeletedPayload = {
    canvasId,
    connectionId,
  };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_CONNECTION_DELETED, broadcastPayload);

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
      `Connection not found: ${connectionId}`,
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
    success: true,
    connection: updatedConnection,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_UPDATED, response);

    const broadcastPayload: BroadcastConnectionUpdatedPayload = {
      canvasId,
      connection: updatedConnection,
    };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_CONNECTION_UPDATED, broadcastPayload);
  }
);
