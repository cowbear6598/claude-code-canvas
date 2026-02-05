import type { GenericNoteStore, BaseNote } from '../../services/GenericNoteStore.js';
import type { WebSocketResponseEvents } from '../../schemas';
import { socketService } from '../../services/socketService.js';
import { emitError } from '../../utils/websocketResponse.js';
import { logger } from '../../utils/logger.js';
import { withCanvasId } from '../../utils/handlerHelpers.js';

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
  canvasId: string;
  success: true;
}


export function createNoteHandlers<TNote extends BaseNote>(
  config: NoteHandlerConfig<TNote>
): {
  handleNoteCreate: (connectionId: string, payload: CreateNotePayload, requestId: string) => Promise<void>;
  handleNoteList: (connectionId: string, payload: ListNotePayload, requestId: string) => Promise<void>;
  handleNoteUpdate: (connectionId: string, payload: UpdateNotePayload, requestId: string) => Promise<void>;
  handleNoteDelete: (connectionId: string, payload: DeleteNotePayload, requestId: string) => Promise<void>;
} {
  const { noteStore, events, foreignKeyField, entityName } = config;

  const handleNoteCreate = withCanvasId<CreateNotePayload>(
    events.created,
    async (connectionId: string, canvasId: string, payload: CreateNotePayload, requestId: string): Promise<void> => {
      const { name, x, y, boundToPodId, originalPosition, ...rest } = payload;
      const foreignKeyValue = rest[foreignKeyField] as string;

      if (config.validateBeforeCreate) {
        const isValid = await config.validateBeforeCreate(foreignKeyValue);
        if (!isValid) {
          emitError(
            connectionId,
            events.created,
            `${entityName} 找不到: ${foreignKeyValue}`,
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
        canvasId,
        success: true,
        note,
      };

      socketService.emitToCanvas(canvasId, events.created, response);

      if (entityName === 'OutputStyle') {
        logger.log('Note', 'Create', `Created note ${note.id} (${note.name})`);
      }
    }
  );

  const handleNoteList = withCanvasId<ListNotePayload>(
    events.listResult,
    async (connectionId: string, canvasId: string, _: ListNotePayload, requestId: string): Promise<void> => {
      const notes = noteStore.list(canvasId);

      const response: BaseNoteResponse & { notes: TNote[] } = {
        requestId,
        canvasId,
        success: true,
        notes,
      };

      socketService.emitToConnection(connectionId, events.listResult, response);
    }
  );

  const handleNoteUpdate = withCanvasId<UpdateNotePayload>(
    events.updated,
    async (connectionId: string, canvasId: string, payload: UpdateNotePayload, requestId: string): Promise<void> => {
      const { noteId, x, y, boundToPodId, originalPosition } = payload;

      const existingNote = noteStore.getById(canvasId, noteId);
      if (!existingNote) {
        emitError(
          connectionId,
          events.updated,
          `Note 找不到: ${noteId}`,
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
          connectionId,
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
        canvasId,
        success: true,
        note: updatedNote,
      };

      socketService.emitToCanvas(canvasId, events.updated, response);
    }
  );

  const handleNoteDelete = withCanvasId<DeleteNotePayload>(
    events.deleted,
    async (connectionId: string, canvasId: string, payload: DeleteNotePayload, requestId: string): Promise<void> => {
      const { noteId } = payload;

      const note = noteStore.getById(canvasId, noteId);
      if (!note) {
        emitError(
          connectionId,
          events.deleted,
          `Note 找不到: ${noteId}`,
          requestId,
          undefined,
          'NOT_FOUND'
        );
        return;
      }

      const deleted = noteStore.delete(canvasId, noteId);

      if (!deleted) {
        emitError(
          connectionId,
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
        canvasId,
        success: true,
        noteId,
      };

      socketService.emitToCanvas(canvasId, events.deleted, response);

      if (entityName === 'OutputStyle') {
        logger.log('Note', 'Delete', `Deleted note ${noteId}`);
      }
    }
  );

  return {
    handleNoteCreate,
    handleNoteList,
    handleNoteUpdate,
    handleNoteDelete,
  };
}
