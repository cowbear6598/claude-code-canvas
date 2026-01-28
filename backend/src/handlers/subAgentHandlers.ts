import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type SubAgentNote,
  type SubAgentListResultPayload,
  type SubAgentNoteCreatedPayload,
  type SubAgentNoteListResultPayload,
  type SubAgentNoteUpdatedPayload,
  type SubAgentNoteDeletedPayload,
  type PodSubAgentBoundPayload,
  type SubAgentDeletedPayload,
} from '../types/index.js';
import type {
  SubAgentListPayload,
  SubAgentNoteCreatePayload,
  SubAgentNoteListPayload,
  SubAgentNoteUpdatePayload,
  SubAgentNoteDeletePayload,
  PodBindSubAgentPayload,
  SubAgentDeletePayload,
} from '../schemas/index.js';
import { subAgentService } from '../services/subAgentService.js';
import { subAgentNoteStore } from '../services/subAgentNoteStore.js';
import { podStore } from '../services/podStore.js';
import { repositoryService } from '../services/repositoryService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleSubAgentList(
  socket: Socket,
  _: SubAgentListPayload,
  requestId: string
): Promise<void> {
  const subAgents = await subAgentService.listSubAgents();

  const response: SubAgentListResultPayload = {
    requestId,
    success: true,
    subAgents,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_LIST_RESULT, response);
}

export async function handleSubAgentNoteCreate(
  socket: Socket,
  payload: SubAgentNoteCreatePayload,
  requestId: string
): Promise<void> {
  const { subAgentId, name, x, y, boundToPodId, originalPosition } = payload;

  const note = subAgentNoteStore.create({
    subAgentId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  const response: SubAgentNoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_NOTE_CREATED, response);

  logger.log('SubAgent', 'Create', `Created subagent note ${note.id} (${note.name})`);
}

export async function handleSubAgentNoteList(
  socket: Socket,
  _: SubAgentNoteListPayload,
  requestId: string
): Promise<void> {
  const notes = subAgentNoteStore.list();

  const response: SubAgentNoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT, response);
}

export async function handleSubAgentNoteUpdate(
  socket: Socket,
  payload: SubAgentNoteUpdatePayload,
  requestId: string
): Promise<void> {
  const { noteId, x, y, boundToPodId, originalPosition } = payload;

  const existingNote = subAgentNoteStore.getById(noteId);
  if (!existingNote) {
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const updates: Partial<Omit<SubAgentNote, 'id'>> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = subAgentNoteStore.update(noteId, updates);
  if (!updatedNote) {
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
      `Failed to update note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: SubAgentNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED, response);
}

export async function handleSubAgentNoteDelete(
  socket: Socket,
  payload: SubAgentNoteDeletePayload,
  requestId: string
): Promise<void> {
  const { noteId } = payload;

  const note = subAgentNoteStore.getById(noteId);
  if (!note) {
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const deleted = subAgentNoteStore.delete(noteId);
  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
      `Failed to delete note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: SubAgentNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_NOTE_DELETED, response);

  logger.log('SubAgent', 'Delete', `Deleted subagent note ${noteId}`);
}

export async function handlePodBindSubAgent(
  socket: Socket,
  payload: PodBindSubAgentPayload,
  requestId: string
): Promise<void> {
  const { podId, subAgentId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_SUBAGENT_BOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
    return;
  }

  const subAgentExists = await subAgentService.exists(subAgentId);
  if (!subAgentExists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_SUBAGENT_BOUND,
      `SubAgent not found: ${subAgentId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
    return;
  }

  if (pod.subAgentIds.includes(subAgentId)) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_SUBAGENT_BOUND,
      `SubAgent ${subAgentId} is already bound to Pod ${podId}`,
      requestId,
      podId,
      'CONFLICT'
    );
    return;
  }

  if (pod.repositoryId) {
    const repositoryPath = repositoryService.getRepositoryPath(pod.repositoryId);
    await subAgentService.copySubAgentToRepository(subAgentId, repositoryPath);
  } else {
    await subAgentService.copySubAgentToPod(subAgentId, podId);
  }

  podStore.addSubAgentId(podId, subAgentId);
  const updatedPod = podStore.getById(podId);

  const response: PodSubAgentBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_SUBAGENT_BOUND, response);

  logger.log('SubAgent', 'Bind', `Bound subagent ${subAgentId} to Pod ${podId}`);
}

export async function handleSubAgentDelete(
  socket: Socket,
  payload: SubAgentDeletePayload,
  requestId: string
): Promise<void> {
  const { subAgentId } = payload;

  const exists = await subAgentService.exists(subAgentId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_DELETED,
      `SubAgent not found: ${subAgentId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const podsUsingSubAgent = podStore.findBySubAgentId(subAgentId);
  if (podsUsingSubAgent.length > 0) {
    const podNames = podsUsingSubAgent.map((pod) => pod.name).join(', ');
    emitError(
      socket,
      WebSocketResponseEvents.SUBAGENT_DELETED,
      `SubAgent is in use by pods: ${podNames}`,
      requestId,
      undefined,
      'IN_USE'
    );
    return;
  }

  const deletedNoteIds = subAgentNoteStore.deleteBySubAgentId(subAgentId);
  await subAgentService.delete(subAgentId);

  const response: SubAgentDeletedPayload = {
    requestId,
    success: true,
    subAgentId,
    deletedNoteIds,
  };

  emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_DELETED, response);

  logger.log('SubAgent', 'Delete', `Deleted subagent ${subAgentId} and ${deletedNoteIds.length} notes`);
}
