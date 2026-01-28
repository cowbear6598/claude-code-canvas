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

export async function handlePodCreate(
  socket: Socket,
  payload: PodCreatePayload,
  requestId: string
): Promise<void> {
  const { name, type, color, x, y, rotation } = payload;

  const pod = podStore.create({ name, type, color, x, y, rotation });

  const workspaceResult = await workspaceService.createWorkspace(pod.id);
  if (!workspaceResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_CREATED,
      `建立工作區失敗 (Pod ${pod.id})`,
      requestId,
      pod.id,
      'INTERNAL_ERROR'
    );
    return;
  }

  await claudeSessionManager.createSession(pod.id, pod.workspacePath);

  const response: PodCreatedPayload = {
    requestId,
    success: true,
    pod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_CREATED, response);

  console.log(`[Pod] Created Pod ${pod.id} (${pod.name})`);
}

export async function handlePodList(
  socket: Socket,
  _: PodListPayload,
  requestId: string
): Promise<void> {
  const pods = podStore.getAll();

  const response: PodListResultPayload = {
    requestId,
    success: true,
    pods,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_LIST_RESULT, response);

  console.log(`[Pod] Listed ${pods.length} Pods`);
}

export async function handlePodGet(
  socket: Socket,
  payload: PodGetPayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

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

  const response: PodGetResultPayload = {
    requestId,
    success: true,
    pod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_GET_RESULT, response);

  console.log(`[Pod] Retrieved Pod ${podId}`);
}

export async function handlePodDelete(
  socket: Socket,
  payload: PodDeletePayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

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

  workflowService.handleSourceDeletion(podId);

  await claudeSessionManager.destroySession(podId);

  const deleteResult = await workspaceService.deleteWorkspace(podId);
  if (!deleteResult.success) {
    console.error(`[Pod] Failed to delete workspace for Pod ${podId}: ${deleteResult.error}`);
  }

  const deletedOutputStyleNotes = noteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedOutputStyleNotes} bound output style notes for Pod ${podId}`);

  const deletedSkillNotes = skillNoteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedSkillNotes} bound skill notes for Pod ${podId}`);

  const deletedRepositoryNotes = repositoryNoteStore.deleteByBoundPodId(podId);
  console.log(`[Pod] Deleted ${deletedRepositoryNotes} bound repository notes for Pod ${podId}`);

  const deletedConnections = connectionStore.deleteByPodId(podId);
  console.log(`[Pod] Deleted ${deletedConnections} related connections for Pod ${podId}`);

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

  const response: PodDeletedPayload = {
    requestId,
    success: true,
    podId,
  };

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

  const response: PodUpdatedPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_UPDATED, response);

  console.log(`[Pod] Updated Pod ${podId}`);
}
