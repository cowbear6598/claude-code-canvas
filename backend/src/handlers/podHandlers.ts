// Pod WebSocket Handlers
// Handles Pod CRUD operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodListPayload,
  type PodGetPayload,
  type PodUpdatePayload,
  type PodDeletePayload,
  type PodCreatedPayload,
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodUpdatedPayload,
  type PodDeletedPayload,
} from '../types/index.js';
import { podStore } from '../services/podStore.js';
import { workspaceService } from '../services/workspace/index.js';
import { claudeSessionManager } from '../services/claude/sessionManager.js';
import {
  emitSuccess,
  emitError,
  validatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

/**
 * Handle Pod creation request
 */
export async function handlePodCreate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<PodCreatePayload>(payload, [
      'requestId',
      'name',
      'type',
      'color',
      'x',
      'y',
      'rotation',
    ]);

    const { requestId, name, type, color, x, y, rotation } = payload;

    // Create Pod in store with canvas position
    const pod = podStore.create({ name, type, color, x, y, rotation });

    // Create workspace directory
    await workspaceService.createWorkspace(pod.id);

    // Create Claude session for this Pod
    await claudeSessionManager.createSession(pod.id, pod.workspacePath);

    // Emit success response
    const response: PodCreatedPayload = {
      requestId,
      success: true,
      pod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_CREATED, response);

    console.log(`[Pod] Created Pod ${pod.id} (${pod.name})`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_CREATED,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Pod] Failed to create Pod: ${errorMessage}`);
  }
}

/**
 * Handle Pod list request
 */
export async function handlePodList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<PodListPayload>(payload, ['requestId']);

    const { requestId } = payload;

    // Get all Pods
    const pods = podStore.getAll();

    // Emit success response
    const response: PodListResultPayload = {
      requestId,
      success: true,
      pods,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_LIST_RESULT, response);

    console.log(`[Pod] Listed ${pods.length} Pods`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_LIST_RESULT,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Pod] Failed to list Pods: ${errorMessage}`);
  }
}

/**
 * Handle Pod get request
 */
export async function handlePodGet(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<PodGetPayload>(payload, ['requestId', 'podId']);

    const { requestId, podId } = payload;

    // Get Pod by ID
    const pod = podStore.getById(podId);

    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    // Emit success response
    const response: PodGetResultPayload = {
      requestId,
      success: true,
      pod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_GET_RESULT, response);

    console.log(`[Pod] Retrieved Pod ${podId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_GET_RESULT,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Pod] Failed to get Pod: ${errorMessage}`);
  }
}

/**
 * Handle Pod delete request
 */
export async function handlePodDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<PodDeletePayload>(payload, ['requestId', 'podId']);

    const { requestId, podId } = payload;

    // Check if Pod exists
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    // Destroy Claude session
    await claudeSessionManager.destroySession(podId);

    // Delete workspace
    await workspaceService.deleteWorkspace(podId);

    // Delete Pod from store
    const deleted = podStore.delete(podId);

    if (!deleted) {
      throw new Error(`Failed to delete Pod from store: ${podId}`);
    }

    // Emit success response
    const response: PodDeletedPayload = {
      requestId,
      success: true,
      podId,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_DELETED, response);

    console.log(`[Pod] Deleted Pod ${podId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    const podId =
      typeof payload === 'object' && payload && 'podId' in payload
        ? (payload.podId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_DELETED,
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[Pod] Failed to delete Pod: ${errorMessage}`);
  }
}

/**
 * Handle Pod update request (position, name, etc.)
 */
export async function handlePodUpdate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<PodUpdatePayload>(payload, ['requestId', 'podId']);

    const { requestId, podId, x, y, rotation, name } = payload as PodUpdatePayload;

    // Check if Pod exists
    const existingPod = podStore.getById(podId);
    if (!existingPod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (rotation !== undefined) updates.rotation = rotation;
    if (name !== undefined) updates.name = name;

    // Update Pod in store
    const updatedPod = podStore.update(podId, updates);

    if (!updatedPod) {
      throw new Error(`Failed to update Pod: ${podId}`);
    }

    // Emit success response
    const response: PodUpdatedPayload = {
      requestId,
      success: true,
      pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_UPDATED, response);

    console.log(`[Pod] Updated Pod ${podId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    const podId =
      typeof payload === 'object' && payload && 'podId' in payload
        ? (payload.podId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_UPDATED,
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[Pod] Failed to update Pod: ${errorMessage}`);
  }
}
