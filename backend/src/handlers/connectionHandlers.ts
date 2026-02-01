import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type ConnectionCreatedPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletedPayload,
  type ConnectionUpdatedPayload,
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
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleConnectionCreate(
  socket: Socket,
  payload: ConnectionCreatePayload,
  requestId: string
): Promise<void> {
  const { sourceType, sourcePodId, sourceTriggerId, sourceAnchor, targetPodId, targetAnchor } = payload;

  if (sourceType === 'pod') {
    const sourcePod = podStore.getById(sourcePodId!);
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
    const sourceTrigger = triggerStore.getById(sourceTriggerId!);
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

  const targetPod = podStore.getById(targetPodId);
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

  const connection = connectionStore.create({
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

  const sourceId = sourceType === 'trigger' ? sourceTriggerId : sourcePodId;
  logger.log('Connection', 'Create', `Created connection ${connection.id} (${sourceType}:${sourceId} -> ${targetPodId})`);
}

export async function handleConnectionList(
  socket: Socket,
  _: ConnectionListPayload,
  requestId: string
): Promise<void> {
  const connections = connectionStore.list();

  const response: ConnectionListResultPayload = {
    requestId,
    success: true,
    connections,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_LIST_RESULT, response);
}

export async function handleConnectionDelete(
  socket: Socket,
  payload: ConnectionDeletePayload,
  requestId: string
): Promise<void> {
  const { connectionId } = payload;

  const connection = connectionStore.getById(connectionId);
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

  workflowStateService.handleConnectionDeletion(connectionId);

  const deleted = connectionStore.delete(connectionId);

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

  logger.log('Connection', 'Delete', `Deleted connection ${connectionId}`);
}

export async function handleConnectionUpdate(
  socket: Socket,
  payload: ConnectionUpdatePayload,
  requestId: string
): Promise<void> {
  const { connectionId, autoTrigger } = payload;

  const connection = connectionStore.getById(connectionId);
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

  const updatedConnection = connectionStore.update(connectionId, updates);

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
}
