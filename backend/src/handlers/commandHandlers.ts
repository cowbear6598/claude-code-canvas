import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type CommandListResultPayload,
  type CommandNoteCreatedPayload,
  type CommandNoteListResultPayload,
  type CommandNoteUpdatedPayload,
  type CommandNoteDeletedPayload,
  type PodCommandBoundPayload,
  type PodCommandUnboundPayload,
  type CommandDeletedPayload,
} from '../types/index.js';
import type {
  CommandListPayload,
  CommandNoteCreatePayload,
  CommandNoteListPayload,
  CommandNoteUpdatePayload,
  CommandNoteDeletePayload,
  PodBindCommandPayload,
  PodUnbindCommandPayload,
  CommandDeletePayload,
} from '../schemas/index.js';
import { commandService } from '../services/commandService.js';
import { commandNoteStore } from '../services/commandNoteStore.js';
import { podStore } from '../services/podStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleCommandList(
  socket: Socket,
  _: CommandListPayload,
  requestId: string
): Promise<void> {
  const commands = await commandService.listCommands();

  const response: CommandListResultPayload = {
    requestId,
    success: true,
    commands,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_LIST_RESULT, response);
}

export async function handleCommandNoteCreate(
  socket: Socket,
  payload: CommandNoteCreatePayload,
  requestId: string
): Promise<void> {
  const { commandId, name, x, y, boundToPodId, originalPosition } = payload;

  const note = commandNoteStore.create({
    commandId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  const response: CommandNoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_NOTE_CREATED, response);
}

export async function handleCommandNoteList(
  socket: Socket,
  _: CommandNoteListPayload,
  requestId: string
): Promise<void> {
  const notes = commandNoteStore.list();

  const response: CommandNoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT, response);
}

export async function handleCommandNoteUpdate(
  socket: Socket,
  payload: CommandNoteUpdatePayload,
  requestId: string
): Promise<void> {
  const { noteId, x, y, boundToPodId, originalPosition } = payload;

  const existingNote = commandNoteStore.getById(noteId);
  if (!existingNote) {
    emitError(
      socket,
      WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const updates: Partial<Omit<import('../types/commandNote.js').CommandNote, 'id'>> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = commandNoteStore.update(noteId, updates);
  if (!updatedNote) {
    emitError(
      socket,
      WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
      `Failed to update note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: CommandNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_NOTE_UPDATED, response);
}

export async function handleCommandNoteDelete(
  socket: Socket,
  payload: CommandNoteDeletePayload,
  requestId: string
): Promise<void> {
  const { noteId } = payload;

  const note = commandNoteStore.getById(noteId);
  if (!note) {
    emitError(
      socket,
      WebSocketResponseEvents.COMMAND_NOTE_DELETED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  commandNoteStore.delete(noteId);

  const response: CommandNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_NOTE_DELETED, response);
}

export async function handlePodBindCommand(
  socket: Socket,
  payload: PodBindCommandPayload,
  requestId: string
): Promise<void> {
  const { podId, commandId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_COMMAND_BOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
    return;
  }

  const commandExists = await commandService.exists(commandId);
  if (!commandExists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_COMMAND_BOUND,
      `Command not found: ${commandId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
    return;
  }

  if (pod.commandId) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_COMMAND_BOUND,
      `Pod ${podId} already has command ${pod.commandId} bound. Please unbind first.`,
      requestId,
      podId,
      'CONFLICT'
    );
    return;
  }

  await commandService.copyCommandToPod(commandId, podId);

  podStore.setCommandId(podId, commandId);
  const updatedPod = podStore.getById(podId);

  const response: PodCommandBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_BOUND, response);
  logger.log('Command', 'Bind', `Bound command ${commandId} to Pod ${podId}`);
}

export async function handlePodUnbindCommand(
  socket: Socket,
  payload: PodUnbindCommandPayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_COMMAND_UNBOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
    return;
  }

  if (!pod.commandId) {
    const response: PodCommandUnboundPayload = {
      requestId,
      success: true,
      pod,
    };
    emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_UNBOUND, response);
    return;
  }

  await commandService.deleteCommandFromPath(pod.workspacePath);

  podStore.setCommandId(podId, null);
  const updatedPod = podStore.getById(podId);

  const response: PodCommandUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_UNBOUND, response);
  logger.log('Command', 'Unbind', `Unbound command from Pod ${podId}`);
}

export async function handleCommandDelete(
  socket: Socket,
  payload: CommandDeletePayload,
  requestId: string
): Promise<void> {
  const { commandId } = payload;

  const exists = await commandService.exists(commandId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.COMMAND_DELETED,
      `Command not found: ${commandId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const podsUsingCommand = podStore.findByCommandId(commandId);
  if (podsUsingCommand.length > 0) {
    const podNames = podsUsingCommand.map((pod) => pod.name).join(', ');
    emitError(
      socket,
      WebSocketResponseEvents.COMMAND_DELETED,
      `Command is in use by pods: ${podNames}`,
      requestId,
      undefined,
      'IN_USE'
    );
    return;
  }

  const deletedNoteIds = commandNoteStore.deleteByCommandId(commandId);
  await commandService.delete(commandId);

  const response: CommandDeletedPayload = {
    requestId,
    success: true,
    commandId,
    deletedNoteIds,
  };

  emitSuccess(socket, WebSocketResponseEvents.COMMAND_DELETED, response);
  logger.log('Command', 'Delete', `Deleted command ${commandId} and ${deletedNoteIds.length} notes`);
}
