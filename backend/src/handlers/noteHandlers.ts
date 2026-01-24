// Output Style Note WebSocket Handlers
// Handles note CRUD operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type NoteCreatePayload,
  type NoteListPayload,
  type NoteUpdatePayload,
  type NoteDeletePayload,
  type NoteCreatedPayload,
  type NoteListResultPayload,
  type NoteUpdatedPayload,
  type NoteDeletedPayload,
} from '../types/index.js';
import { noteStore } from '../services/noteStore.js';
import {
  emitSuccess,
  emitError,
  tryValidatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

/**
 * Handle note creation request
 */
export async function handleNoteCreate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<NoteCreatePayload>(payload, [
    'requestId',
    'outputStyleId',
    'name',
    'x',
    'y',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_CREATED,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Note] Failed to create note: ${validation.error}`);
    return;
  }

  const { requestId, outputStyleId, name, x, y, boundToPodId, originalPosition } =
    validation.data!;

  // Create note in store
  const note = noteStore.create({
    outputStyleId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  // Emit success response
  const response: NoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_CREATED, response);

  console.log(`[Note] Created note ${note.id} (${note.name})`);
}

/**
 * Handle note list request
 */
export async function handleNoteList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<NoteListPayload>(payload, ['requestId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_LIST_RESULT,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Note] Failed to list notes: ${validation.error}`);
    return;
  }

  const { requestId } = validation.data!;

  // Get all notes
  const notes = noteStore.list();

  // Emit success response
  const response: NoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_LIST_RESULT, response);

  console.log(`[Note] Listed ${notes.length} notes`);
}

/**
 * Handle note update request
 */
export async function handleNoteUpdate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<NoteUpdatePayload>(payload, ['requestId', 'noteId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_UPDATED,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Note] Failed to update note: ${validation.error}`);
    return;
  }

  const { requestId, noteId, x, y, boundToPodId, originalPosition } = validation.data!;

  // Check if note exists
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

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  // Update note in store
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

  // Emit success response
  const response: NoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_UPDATED, response);

  console.log(`[Note] Updated note ${noteId}`);
}

/**
 * Handle note delete request
 */
export async function handleNoteDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<NoteDeletePayload>(payload, ['requestId', 'noteId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_DELETED,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[Note] Failed to delete note: ${validation.error}`);
    return;
  }

  const { requestId, noteId } = validation.data!;

  // Check if note exists
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

  // Delete note from store
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

  // Emit success response
  const response: NoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.NOTE_DELETED, response);

  console.log(`[Note] Deleted note ${noteId}`);
}
