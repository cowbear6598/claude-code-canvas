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
  validatePayload,
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
  try {
    // Validate payload
    validatePayload<NoteCreatePayload>(payload, [
      'requestId',
      'outputStyleId',
      'name',
      'x',
      'y',
    ]);

    const { requestId, outputStyleId, name, x, y, boundToPodId, originalPosition } =
      payload as NoteCreatePayload;

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
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_CREATED,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Note] Failed to create note: ${errorMessage}`);
  }
}

/**
 * Handle note list request
 */
export async function handleNoteList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<NoteListPayload>(payload, ['requestId']);

    const { requestId } = payload;

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
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_LIST_RESULT,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Note] Failed to list notes: ${errorMessage}`);
  }
}

/**
 * Handle note update request
 */
export async function handleNoteUpdate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<NoteUpdatePayload>(payload, ['requestId', 'noteId']);

    const { requestId, noteId, x, y, boundToPodId, originalPosition } =
      payload as NoteUpdatePayload;

    // Check if note exists
    const existingNote = noteStore.getById(noteId);
    if (!existingNote) {
      throw new Error(`Note not found: ${noteId}`);
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
      throw new Error(`Failed to update note: ${noteId}`);
    }

    // Emit success response
    const response: NoteUpdatedPayload = {
      requestId,
      success: true,
      note: updatedNote,
    };

    emitSuccess(socket, WebSocketResponseEvents.NOTE_UPDATED, response);

    console.log(`[Note] Updated note ${noteId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_UPDATED,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Note] Failed to update note: ${errorMessage}`);
  }
}

/**
 * Handle note delete request
 */
export async function handleNoteDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload
    validatePayload<NoteDeletePayload>(payload, ['requestId', 'noteId']);

    const { requestId, noteId } = payload;

    // Check if note exists
    const note = noteStore.getById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Delete note from store
    const deleted = noteStore.delete(noteId);

    if (!deleted) {
      throw new Error(`Failed to delete note from store: ${noteId}`);
    }

    // Emit success response
    const response: NoteDeletedPayload = {
      requestId,
      success: true,
      noteId,
    };

    emitSuccess(socket, WebSocketResponseEvents.NOTE_DELETED, response);

    console.log(`[Note] Deleted note ${noteId}`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.NOTE_DELETED,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[Note] Failed to delete note: ${errorMessage}`);
  }
}
