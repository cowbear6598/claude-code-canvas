import type { Socket } from 'socket.io';
import type { GenericNoteStore, BaseNote } from '../../services/GenericNoteStore.js';
import type { WebSocketResponseEvents } from '../../types/index.js';
import { emitSuccess, emitError } from '../../utils/websocketResponse.js';
import { logger } from '../../utils/logger.js';
import { getCanvasId } from '../../utils/handlerHelpers.js';

interface NoteHandlerConfig<TNote extends BaseNote> {
  noteStore: GenericNoteStore<TNote, keyof TNote>;
  events: {
    created: WebSocketResponseEvents;
    listResult: WebSocketResponseEvents;
    updated: WebSocketResponseEvents;
    deleted: WebSocketResponseEvents;
  };
  foreignKeyField: string;
  entityName: string;
  validateBeforeCreate?: (foreignKeyValue: string) => Promise<boolean>;
}

export interface CreateNotePayload {
  name: string;
  x: number;
  y: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
  [key: string]: unknown;
}

export interface ListNotePayload {
  [key: string]: unknown;
}

export interface UpdateNotePayload {
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface DeleteNotePayload {
  noteId: string;
}

interface BaseNoteResponse {
  requestId: string;
  success: true;
}


export function createNoteHandlers<TNote extends BaseNote>(
  config: NoteHandlerConfig<TNote>
): {
  handleNoteCreate: (socket: Socket, payload: CreateNotePayload, requestId: string) => Promise<void>;
  handleNoteList: (socket: Socket, payload: ListNotePayload, requestId: string) => Promise<void>;
  handleNoteUpdate: (socket: Socket, payload: UpdateNotePayload, requestId: string) => Promise<void>;
  handleNoteDelete: (socket: Socket, payload: DeleteNotePayload, requestId: string) => Promise<void>;
} {
  const { noteStore, events, foreignKeyField, entityName } = config;

  async function handleNoteCreate(
    socket: Socket,
    payload: CreateNotePayload,
    requestId: string
  ): Promise<void> {
    const { name, x, y, boundToPodId, originalPosition, ...rest } = payload;
    const foreignKeyValue = rest[foreignKeyField] as string;

    const canvasId = getCanvasId(socket, events.created, requestId);
    if (!canvasId) {
      return;
    }

    if (config.validateBeforeCreate) {
      const isValid = await config.validateBeforeCreate(foreignKeyValue);
      if (!isValid) {
        emitError(
          socket,
          events.created,
          `${entityName} not found: ${foreignKeyValue}`,
          requestId,
          undefined,
          'NOT_FOUND'
        );
        return;
      }
    }

    const createData = {
      [foreignKeyField]: foreignKeyValue,
      name,
      x,
      y,
      boundToPodId: boundToPodId ?? null,
      originalPosition: originalPosition ?? null,
    } as Omit<TNote, 'id'>;

    const note = noteStore.create(canvasId, createData);

    const response: BaseNoteResponse & { note: TNote } = {
      requestId,
      success: true,
      note,
    };

    emitSuccess(socket, events.created, response);

    if (entityName === 'OutputStyle') {
      logger.log('Note', 'Create', `Created note ${note.id} (${note.name})`);
    }
  }

  async function handleNoteList(
    socket: Socket,
    _: ListNotePayload,
    requestId: string
  ): Promise<void> {
    const canvasId = getCanvasId(socket, events.listResult, requestId);
    if (!canvasId) {
      return;
    }

    const notes = noteStore.list(canvasId);

    const response: BaseNoteResponse & { notes: TNote[] } = {
      requestId,
      success: true,
      notes,
    };

    emitSuccess(socket, events.listResult, response);
  }

  async function handleNoteUpdate(
    socket: Socket,
    payload: UpdateNotePayload,
    requestId: string
  ): Promise<void> {
    const { noteId, x, y, boundToPodId, originalPosition } = payload;

    const canvasId = getCanvasId(socket, events.updated, requestId);
    if (!canvasId) {
      return;
    }

    const existingNote = noteStore.getById(canvasId, noteId);
    if (!existingNote) {
      emitError(
        socket,
        events.updated,
        `Note not found: ${noteId}`,
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

    const updatedNote = noteStore.update(canvasId, noteId, updates as Partial<Omit<TNote, 'id'>>);

    if (!updatedNote) {
      emitError(
        socket,
        events.updated,
        `Failed to update note: ${noteId}`,
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );
      return;
    }

    const response: BaseNoteResponse & { note: TNote } = {
      requestId,
      success: true,
      note: updatedNote,
    };

    emitSuccess(socket, events.updated, response);
  }

  async function handleNoteDelete(
    socket: Socket,
    payload: DeleteNotePayload,
    requestId: string
  ): Promise<void> {
    const { noteId } = payload;

    const canvasId = getCanvasId(socket, events.deleted, requestId);
    if (!canvasId) {
      return;
    }

    const note = noteStore.getById(canvasId, noteId);
    if (!note) {
      emitError(
        socket,
        events.deleted,
        `Note not found: ${noteId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    const deleted = noteStore.delete(canvasId, noteId);

    if (!deleted) {
      emitError(
        socket,
        events.deleted,
        `Failed to delete note from store: ${noteId}`,
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );
      return;
    }

    const response: BaseNoteResponse & { noteId: string } = {
      requestId,
      success: true,
      noteId,
    };

    emitSuccess(socket, events.deleted, response);

    if (entityName === 'OutputStyle') {
      logger.log('Note', 'Delete', `Deleted note ${noteId}`);
    }
  }

  return {
    handleNoteCreate,
    handleNoteList,
    handleNoteUpdate,
    handleNoteDelete,
  };
}
