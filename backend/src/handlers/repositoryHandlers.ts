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
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import {
  cleanupOldRepositoryResources,
  copyResourcesToNewPath,
  clearPodMessages,
} from './repository/repositoryBindHelpers.js';
import { logger } from '../utils/logger.js';

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
}

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
    return;
  }

  const repository = await repositoryService.createRepository(name);

  const response: RepositoryCreatedPayload = {
    requestId,
    success: true,
    repository,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_CREATED, response);

  logger.log('Repository', 'Create', `Created repository ${repository.id}`);
}

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
}

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
}

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
    return;
  }

  const response: RepositoryNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED, response);
}

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
    return;
  }

  const response: RepositoryNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_NOTE_DELETED, response);
}

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
    return;
  }

  const oldRepositoryId = pod.repositoryId;
  const oldCwd = oldRepositoryId
    ? repositoryService.getRepositoryPath(oldRepositoryId)
    : pod.workspacePath;

  await cleanupOldRepositoryResources(oldCwd);

  podStore.setRepositoryId(podId, repositoryId);
  podStore.setClaudeSessionId(podId, '');

  const newCwd = repositoryService.getRepositoryPath(repositoryId);
  await copyResourcesToNewPath(pod, newCwd, true);
  await clearPodMessages(socket, podId);

  const updatedPod = podStore.getById(podId);

  const response: PodRepositoryBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_BOUND, response);

  logger.log('Repository', 'Bind', `Bound repository ${repositoryId} to Pod ${podId}`);
}

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
    return;
  }

  const oldRepositoryId = pod.repositoryId;

  const oldCwd = oldRepositoryId
    ? repositoryService.getRepositoryPath(oldRepositoryId)
    : pod.workspacePath;

  await cleanupOldRepositoryResources(oldCwd);

  podStore.setRepositoryId(podId, null);
  podStore.setClaudeSessionId(podId, '');

  const newCwd = pod.workspacePath;
  await copyResourcesToNewPath(pod, newCwd, false);
  await clearPodMessages(socket, podId);

  const updatedPod = podStore.getById(podId);

  const response: PodRepositoryUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, response);

  logger.log('Repository', 'Unbind', `Unbound repository from Pod ${podId}`);
}

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

  logger.log('Repository', 'Delete', `Deleted repository ${repositoryId} and ${deletedNoteIds.length} notes`);
}
