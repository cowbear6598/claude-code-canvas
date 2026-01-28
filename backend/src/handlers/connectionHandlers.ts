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
import { workflowService } from '../services/workflow/index.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';

export async function handleConnectionCreate(
  socket: Socket,
  payload: ConnectionCreatePayload,
  requestId: string
): Promise<void> {
  const { sourcePodId, sourceAnchor, targetPodId, targetAnchor } = payload;

  const sourcePod = podStore.getById(sourcePodId);
  if (!sourcePod) {
    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_CREATED,
      `Source Pod not found: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Connection] Failed to create connection: Source Pod not found: ${sourcePodId}`);
    return;
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

    console.error(`[Connection] Failed to create connection: Target Pod not found: ${targetPodId}`);
    return;
  }

  const connection = connectionStore.create({
    sourcePodId,
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

  console.log(`[Connection] Created connection ${connection.id} (${sourcePodId} -> ${targetPodId})`);
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

  console.log(`[Connection] Listed ${connections.length} connections`);
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

    console.error(`[Connection] Failed to delete connection: Connection not found: ${connectionId}`);
    return;
  }

  workflowService.handleConnectionDeletion(connectionId);

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

    console.error(`[Connection] Failed to delete connection from store: ${connectionId}`);
    return;
  }

  const response: ConnectionDeletedPayload = {
    requestId,
    success: true,
    connectionId,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_DELETED, response);

  console.log(`[Connection] Deleted connection ${connectionId}`);
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

    console.error(`[Connection] Failed to update connection: Connection not found: ${connectionId}`);
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

    console.error(`[Connection] Failed to update connection: ${connectionId}`);
    return;
  }

  const response: ConnectionUpdatedPayload = {
    requestId,
    success: true,
    connection: updatedConnection,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_UPDATED, response);

  console.log(`[Connection] Updated connection ${connectionId}`);
}
