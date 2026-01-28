// Repository WebSocket Handlers
// Handles repository and repository note CRUD operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type RepositoryListResultPayload,
  type RepositoryCreatedPayload,
  type RepositoryNoteCreatedPayload,
  type RepositoryNoteListResultPayload,
  type RepositoryNoteUpdatedPayload,
  type RepositoryNoteDeletedPayload,
  type PodRepositoryBoundPayload,
  type PodRepositoryUnboundPayload,
  type RepositoryDeletedPayload,
} from '../types/index.js';
import type {
  RepositoryListPayload,
  RepositoryCreatePayload,
  RepositoryNoteCreatePayload,
  RepositoryNoteListPayload,
  RepositoryNoteUpdatePayload,
  RepositoryNoteDeletePayload,
  PodBindRepositoryPayload,
  PodUnbindRepositoryPayload,
  RepositoryDeletePayload,
} from '../schemas/index.js';
import { repositoryService } from '../services/repositoryService.js';
import { repositoryNoteStore } from '../services/repositoryNoteStore.js';
import { podStore } from '../services/podStore.js';
import { skillService } from '../services/skillService.js';
import { subAgentService } from '../services/subAgentService.js';
import { messageStore } from '../services/messageStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';

/**
 * Handle repository list request
 */
export async function handleRepositoryList(
  socket: Socket,
  _: RepositoryListPayload,
  requestId: string
): Promise<void> {
  const repositories = await repositoryService.listRepositories();

  const response: RepositoryListResultPayload = {
    requestId,
    success: true,
    repositories,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_LIST_RESULT, response);

  console.log(`[Repository] Listed ${repositories.length} repositories`);
}

/**
 * Handle repository creation request
 */
export async function handleRepositoryCreate(
  socket: Socket,
  payload: RepositoryCreatePayload,
  requestId: string
): Promise<void> {
  const { name } = payload;

  const exists = await repositoryService.exists(name);
  if (exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_CREATED,
      `Repository already exists: ${name}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );

    console.error(`[Repository] Failed to create repository: Repository already exists: ${name}`);
    return;
  }

  const repository = await repositoryService.createRepository(name);

  const response: RepositoryCreatedPayload = {
    requestId,
    success: true,
    repository,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_CREATED, response);

  console.log(`[Repository] Created repository ${repository.id}`);
}

/**
 * Handle repository note creation request
 */
export async function handleRepositoryNoteCreate(
  socket: Socket,
  payload: RepositoryNoteCreatePayload,
  requestId: string
): Promise<void> {
  const { repositoryId, name, x, y, boundToPodId, originalPosition } = payload;

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
      `Repository not found: ${repositoryId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to create note: Repository not found: ${repositoryId}`);
    return;
  }

  const note = repositoryNoteStore.create({
    repositoryId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  const response: RepositoryNoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_CREATED, response);

  console.log(`[Repository] Created repository note ${note.id} (${note.name})`);
}

/**
 * Handle repository note list request
 */
export async function handleRepositoryNoteList(
  socket: Socket,
  _: RepositoryNoteListPayload,
  requestId: string
): Promise<void> {
  const notes = repositoryNoteStore.list();

  const response: RepositoryNoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT, response);

  console.log(`[Repository] Listed ${notes.length} repository notes`);
}

/**
 * Handle repository note update request
 */
export async function handleRepositoryNoteUpdate(
  socket: Socket,
  payload: RepositoryNoteUpdatePayload,
  requestId: string
): Promise<void> {
  const { noteId, x, y, boundToPodId, originalPosition } = payload;

  const existingNote = repositoryNoteStore.getById(noteId);
  if (!existingNote) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
      `Repository note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to update note: Repository note not found: ${noteId}`);
    return;
  }

  const updates: Record<string, unknown> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = repositoryNoteStore.update(noteId, updates);

  if (!updatedNote) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
      `Failed to update repository note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Repository] Failed to update repository note: ${noteId}`);
    return;
  }

  const response: RepositoryNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED, response);

  console.log(`[Repository] Updated repository note ${noteId}`);
}

/**
 * Handle repository note deletion request
 */
export async function handleRepositoryNoteDelete(
  socket: Socket,
  payload: RepositoryNoteDeletePayload,
  requestId: string
): Promise<void> {
  const { noteId } = payload;

  const note = repositoryNoteStore.getById(noteId);
  if (!note) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
      `Repository note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to delete note: Repository note not found: ${noteId}`);
    return;
  }

  const deleted = repositoryNoteStore.delete(noteId);

  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
      `Failed to delete repository note from store: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Repository] Failed to delete repository note from store: ${noteId}`);
    return;
  }

  const response: RepositoryNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_DELETED, response);

  console.log(`[Repository] Deleted repository note ${noteId}`);
}

/**
 * Handle pod bind repository request
 */
export async function handlePodBindRepository(
  socket: Socket,
  payload: PodBindRepositoryPayload,
  requestId: string
): Promise<void> {
  const { podId, repositoryId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND,
      `Pod not found: ${podId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to bind repository: Pod not found: ${podId}`);
    return;
  }

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND,
      `Repository not found: ${repositoryId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to bind repository: Repository not found: ${repositoryId}`);
    return;
  }

  const oldRepositoryId = pod.repositoryId;
  const oldCwd = oldRepositoryId
    ? repositoryService.getRepositoryPath(oldRepositoryId)
    : pod.workspacePath;

  try {
    await skillService.deleteSkillsFromPath(oldCwd);
  } catch (error) {
    console.error(`[Repository] Failed to delete old skills from ${oldCwd}:`, error);
  }

  try {
    await subAgentService.deleteSubAgentsFromPath(oldCwd);
  } catch (error) {
    console.error(`[Repository] Failed to delete old subagents from ${oldCwd}:`, error);
  }

  podStore.setRepositoryId(podId, repositoryId);
  podStore.setClaudeSessionId(podId, '');

  const newCwd = repositoryService.getRepositoryPath(repositoryId);

  for (const skillId of pod.skillIds) {
    try {
      await skillService.copySkillToRepository(skillId, newCwd);
    } catch (error) {
      console.error(`[Repository] Failed to copy skill ${skillId} to repository:`, error);
    }
  }

  for (const subAgentId of pod.subAgentIds) {
    try {
      await subAgentService.copySubAgentToRepository(subAgentId, newCwd);
    } catch (error) {
      console.error(`[Repository] Failed to copy subagent ${subAgentId} to repository:`, error);
    }
  }

  try {
    await messageStore.clearMessagesWithPersistence(podId);
    socket.emit(WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
  } catch (error) {
    console.error(`[Repository] Failed to clear messages for Pod ${podId}:`, error);
  }

  const updatedPod = podStore.getById(podId);

  const response: PodRepositoryBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_BOUND, response);

  console.log(`[Repository] Bound repository ${repositoryId} to Pod ${podId}`);
}

/**
 * Handle pod unbind repository request
 */
export async function handlePodUnbindRepository(
  socket: Socket,
  payload: PodUnbindRepositoryPayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
      `Pod not found: ${podId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Repository] Failed to unbind repository: Pod not found: ${podId}`);
    return;
  }

  const oldRepositoryId = pod.repositoryId;
  if (!oldRepositoryId) {
    console.warn(`[Repository] Pod ${podId} has no repository to unbind`);
  }

  const oldCwd = oldRepositoryId
    ? repositoryService.getRepositoryPath(oldRepositoryId)
    : pod.workspacePath;

  try {
    await skillService.deleteSkillsFromPath(oldCwd);
  } catch (error) {
    console.error(`[Repository] Failed to delete old skills from ${oldCwd}:`, error);
  }

  try {
    await subAgentService.deleteSubAgentsFromPath(oldCwd);
  } catch (error) {
    console.error(`[Repository] Failed to delete old subagents from ${oldCwd}:`, error);
  }

  podStore.setRepositoryId(podId, null);
  podStore.setClaudeSessionId(podId, '');

  const newCwd = pod.workspacePath;

  for (const skillId of pod.skillIds) {
    try {
      await skillService.copySkillToRepository(skillId, newCwd);
    } catch (error) {
      console.error(`[Repository] Failed to copy skill ${skillId} to workspace:`, error);
    }
  }

  for (const subAgentId of pod.subAgentIds) {
    try {
      await subAgentService.copySubAgentToRepository(subAgentId, newCwd);
    } catch (error) {
      console.error(`[Repository] Failed to copy subagent ${subAgentId} to workspace:`, error);
    }
  }

  try {
    await messageStore.clearMessagesWithPersistence(podId);
    socket.emit(WebSocketResponseEvents.POD_MESSAGES_CLEARED, { podId });
  } catch (error) {
    console.error(`[Repository] Failed to clear messages for Pod ${podId}:`, error);
  }

  const updatedPod = podStore.getById(podId);

  const response: PodRepositoryUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, response);

  console.log(`[Repository] Unbound repository from Pod ${podId}`);
}

/**
 * Handle repository deletion request
 */
export async function handleRepositoryDelete(
  socket: Socket,
  payload: RepositoryDeletePayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_DELETED,
      `Repository not found: ${repositoryId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    console.error(`[Repository] Failed to delete: Repository not found: ${repositoryId}`);
    return;
  }

  const podsUsingRepository = podStore.findByRepositoryId(repositoryId);
  if (podsUsingRepository.length > 0) {
    const podNames = podsUsingRepository.map((pod) => pod.name).join(', ');
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_DELETED,
      `Repository is in use by pods: ${podNames}`,
      requestId,
      undefined,
      'IN_USE'
    );
    console.error(`[Repository] Failed to delete: Repository ${repositoryId} is in use by pods: ${podNames}`);
    return;
  }

  const deletedNoteIds = repositoryNoteStore.deleteByRepositoryId(repositoryId);
  await repositoryService.delete(repositoryId);

  const response: RepositoryDeletedPayload = {
    requestId,
    success: true,
    repositoryId,
    deletedNoteIds,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_DELETED, response);
  console.log(`[Repository] Deleted repository ${repositoryId} and ${deletedNoteIds.length} notes`);
}
