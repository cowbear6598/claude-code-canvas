import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type NoteCreatedPayload,
  type NoteListResultPayload,
  type NoteUpdatedPayload,
  type NoteDeletedPayload,
} from '../types/index.js';
import type {
  NoteCreatePayload,
  NoteListPayload,
  NoteUpdatePayload,
  NoteDeletePayload,
} from '../schemas/index.js';
import { noteStore } from '../services/noteStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';

export async function handleNoteCreate(
  socket: Socket,
  payload: NoteCreatePayload,
  requestId: string
): Promise<void> {
  const { outputStyleId, name, x, y, boundToPodId, originalPosition } = payload;

  const note = noteStore.create({
    outputStyleId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  const response: NoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_CREATED, response);

  console.log(`[Note] Created note ${note.id} (${note.name})`);
}

export async function handleNoteList(
  socket: Socket,
  _: NoteListPayload,
  requestId: string
): Promise<void> {
  const notes = noteStore.list();

  const response: NoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_LIST_RESULT, response);

  console.log(`[Note] Listed ${notes.length} notes`);
}

export async function handleNoteUpdate(
  socket: Socket,
  payload: NoteUpdatePayload,
  requestId: string
): Promise<void> {
  const { noteId, x, y, boundToPodId, originalPosition } = payload;

  const existingNote = noteStore.getById(noteId);
  if (!existingNote) {
    emitError(
      socket,
      WebSocketResponseEvents.NOTE_UPDATED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Note] Failed to update note: Note not found: ${noteId}`);
    return;
  }

  const updates: Record<string, unknown> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = noteStore.update(noteId, updates);

  if (!updatedNote) {
    emitError(
      socket,
      WebSocketResponseEvents.NOTE_UPDATED,
      `Failed to update note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Note] Failed to update note: ${noteId}`);
    return;
  }

  const response: NoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_UPDATED, response);

  console.log(`[Note] Updated note ${noteId}`);
}

export async function handleNoteDelete(
  socket: Socket,
  payload: NoteDeletePayload,
  requestId: string
): Promise<void> {
  const { noteId } = payload;

  const note = noteStore.getById(noteId);
  if (!note) {
    emitError(
      socket,
      WebSocketResponseEvents.NOTE_DELETED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );

    console.error(`[Note] Failed to delete note: Note not found: ${noteId}`);
    return;
  }

  const deleted = noteStore.delete(noteId);

  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.NOTE_DELETED,
      `Failed to delete note from store: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );

    console.error(`[Note] Failed to delete note from store: ${noteId}`);
    return;
  }

  const response: NoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_DELETED, response);

  console.log(`[Note] Deleted note ${noteId}`);
}
