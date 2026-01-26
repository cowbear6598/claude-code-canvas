import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  noteCreateSchema,
  noteListSchema,
  noteUpdateSchema,
  noteDeleteSchema,
} from '../../schemas/index.js';
import {
  handleNoteCreate,
  handleNoteList,
  handleNoteUpdate,
  handleNoteDelete,
} from '../noteHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const noteHandlerGroup: HandlerGroup = {
  name: 'note',
  handlers: [
    {
      event: WebSocketRequestEvents.NOTE_CREATE,
      handler: handleNoteCreate as unknown as ValidatedHandler<unknown>,
      schema: noteCreateSchema,
      responseEvent: WebSocketResponseEvents.NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.NOTE_LIST,
      handler: handleNoteList as unknown as ValidatedHandler<unknown>,
      schema: noteListSchema,
      responseEvent: WebSocketResponseEvents.NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.NOTE_UPDATE,
      handler: handleNoteUpdate as unknown as ValidatedHandler<unknown>,
      schema: noteUpdateSchema,
      responseEvent: WebSocketResponseEvents.NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.NOTE_DELETE,
      handler: handleNoteDelete as unknown as ValidatedHandler<unknown>,
      schema: noteDeleteSchema,
      responseEvent: WebSocketResponseEvents.NOTE_DELETED,
    },
  ],
};
