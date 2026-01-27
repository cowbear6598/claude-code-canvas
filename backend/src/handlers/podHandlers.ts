// Pod WebSocket Handlers
// Handles Pod CRUD operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type PodCreatedPayload,
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodUpdatedPayload,
  type PodDeletedPayload,
} from '../types/index.js';
import type {
  PodCreatePayload,
  PodListPayload,
  PodGetPayload,
  PodUpdatePayload,
  PodDeletePayload,
} from '../schemas/index.js';
import { podStore } from '../services/podStore.js';
import { workspaceService } from '../services/workspace/index.js';
import { claudeSessionManager } from '../services/claude/sessionManager.js';
import { noteStore } from '../services/noteStore.js';
import { skillNoteStore } from '../services/skillNoteStore.js';
import { repositoryNoteStore } from '../services/repositoryNoteStore.js';
import { connectionStore } from '../services/connectionStore.js';
import { socketService } from '../services/socketService.js';
import { workflowService } from '../services/workflow/index.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';

/**
 * Handle Pod creation request
 */
export async function handlePodCreate(
  socket: Socket,
  payload: PodCreatePayload,
  requestId: string
): Promise<void> {
  const { name, type, color, x, y, rotation } = payload;

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
}

/**
 * Handle Pod list request
 */
export async function handlePodList(
  socket: Socket,
  _: PodListPayload,
  requestId: string
): Promise<void> {
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
}

/**
 * Handle Pod get request
 */
export async function handlePodGet(
  socket: Socket,
  payload: PodGetPayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  // Get Pod by ID
  const pod = podStore.getById(podId);

  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_GET_RESULT,
      `Pod not found: ${podId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Pod] Failed to get Pod: Pod not found: ${podId}`);
    return;
  }

  // Emit success response
  const response: PodGetResultPayload = {
    requestId,
    success: true,
    pod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_GET_RESULT, response);

  console.log(`[Pod] Retrieved Pod ${podId}`);
}

/**
 * Handle Pod delete request
 */
export async function handlePodDelete(
  socket: Socket,
  payload: PodDeletePayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  // Check if Pod exists
  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_DELETED,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    console.error(`[Pod] Failed to delete Pod: Pod not found: ${podId}`);
    return;
  }

  // Handle workflow pending targets before deletion
  workflowService.handleSourceDeletion(podId);

  // Destroy Claude session
  await claudeSessionManager.destroySession(podId);

  // Delete workspace
  await workspaceService.deleteWorkspace(podId);

  // Delete bound Output Style Notes
  const deletedOutputStyleNotes = noteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedOutputStyleNotes} bound output style notes for Pod ${podId}`);

  // Delete bound Skill Notes
  const deletedSkillNotes = skillNoteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedSkillNotes} bound skill notes for Pod ${podId}`);

  // Delete bound Repository Notes
  const deletedRepositoryNotes = repositoryNoteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedRepositoryNotes} bound repository notes for Pod ${podId}`);

  // Delete related Connections
  const deletedConnections = connectionStore.deleteByPodId(podId);
  console.log(`[Pod] Deleted ${deletedConnections} related connections for Pod ${podId}`);

  // Delete Pod from store
  const deleted = podStore.delete(podId);

  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_DELETED,
      `Failed to delete Pod from store: ${podId}`,
      requestId,
      podId,
      'INTERNAL_ERROR'
    );

    console.error(`[Pod] Failed to delete Pod from store: ${podId}`);
    return;
  }

  // Emit success response
  const response: PodDeletedPayload = {
    requestId,
    success: true,
    podId,
  };

  // Broadcast to all clients in the Pod room
  socketService.emitPodDeletedBroadcast(podId, response);

  emitSuccess(socket, WebSocketResponseEvents.POD_DELETED, response);

  console.log(`[Pod] Deleted Pod ${podId}`);
}

/**
 * Handle Pod update request (position, name, etc.)
 */
export async function handlePodUpdate(
  socket: Socket,
  payload: PodUpdatePayload,
  requestId: string
): Promise<void> {
  const { podId, x, y, rotation, name, model } = payload;

  // Check if Pod exists
  const existingPod = podStore.getById(podId);
  if (!existingPod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_UPDATED,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    console.error(`[Pod] Failed to update Pod: Pod not found: ${podId}`);
    return;
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (rotation !== undefined) updates.rotation = rotation;
  if (name !== undefined) updates.name = name;
  if (model !== undefined) {
    updates.model = model;
    // 保留 session，讓 SDK 嘗試用新 model 繼續對話
  }

  // Update Pod in store
  const updatedPod = podStore.update(podId, updates);

  if (!updatedPod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_UPDATED,
      `Failed to update Pod: ${podId}`,
      requestId,
      podId,
      'INTERNAL_ERROR'
    );

    console.error(`[Pod] Failed to update Pod: ${podId}`);
    return;
  }

  // Emit success response
  const response: PodUpdatedPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_UPDATED, response);

  console.log(`[Pod] Updated Pod ${podId}`);
}
