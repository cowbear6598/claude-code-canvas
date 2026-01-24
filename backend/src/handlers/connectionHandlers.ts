// Connection WebSocket Handlers
// Handles Connection CRUD operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
  type ConnectionListPayload,
  type ConnectionDeletePayload,
  type ConnectionCreatedPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletedPayload,
} from '../types/index.js';
import { connectionStore } from '../services/connectionStore.js';
import { podStore } from '../services/podStore.js';
import {
  emitSuccess,
  emitError,
  tryValidatePayload,
} from '../utils/websocketResponse.js';

/**
 * Handle connection creation request
 */
export async function handleConnectionCreate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<ConnectionCreatePayload>(payload, [
    'requestId',
    'sourcePodId',
    'sourceAnchor',
    'targetPodId',
    'targetAnchor',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_CREATED,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Connection] Failed to create connection: ${validation.error}`);
    return;
  }

  const { requestId, sourcePodId, sourceAnchor, targetPodId, targetAnchor } = validation.data!;

  // Check if source Pod exists
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

  // Check if target Pod exists
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

  // Create connection in store
  const connection = connectionStore.create({
    sourcePodId,
    sourceAnchor,
    targetPodId,
    targetAnchor,
  });

  // Emit success response
  const response: ConnectionCreatedPayload = {
    requestId,
    success: true,
    connection,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_CREATED, response);

  console.log(`[Connection] Created connection ${connection.id} (${sourcePodId} -> ${targetPodId})`);
}

/**
 * Handle connection list request
 */
export async function handleConnectionList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<ConnectionListPayload>(payload, ['requestId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_LIST_RESULT,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Connection] Failed to list connections: ${validation.error}`);
    return;
  }

  const { requestId } = validation.data!;

  // Get all connections
  const connections = connectionStore.list();

  // Emit success response
  const response: ConnectionListResultPayload = {
    requestId,
    success: true,
    connections,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_LIST_RESULT, response);

  console.log(`[Connection] Listed ${connections.length} connections`);
}

/**
 * Handle connection delete request
 */
export async function handleConnectionDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<ConnectionDeletePayload>(payload, [
    'requestId',
    'connectionId',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.CONNECTION_DELETED,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Connection] Failed to delete connection: ${validation.error}`);
    return;
  }

  const { requestId, connectionId } = validation.data!;

  // Check if connection exists
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

  // Delete connection from store
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

  // Emit success response
  const response: ConnectionDeletedPayload = {
    requestId,
    success: true,
    connectionId,
  };

  emitSuccess(socket, WebSocketResponseEvents.CONNECTION_DELETED, response);

  console.log(`[Connection] Deleted connection ${connectionId}`);
}
