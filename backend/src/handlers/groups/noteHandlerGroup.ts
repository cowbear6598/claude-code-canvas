import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
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
import { createHandlerGroup } from './createHandlerGroup.js';

export const noteHandlerGroup = createHandlerGroup({
  name: 'note',
  handlers: [
    {
      event: WebSocketRequestEvents.NOTE_CREATE,
      handler: handleNoteCreate,
      schema: noteCreateSchema,
      responseEvent: WebSocketResponseEvents.NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.NOTE_LIST,
      handler: handleNoteList,
      schema: noteListSchema,
      responseEvent: WebSocketResponseEvents.NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.NOTE_UPDATE,
      handler: handleNoteUpdate,
      schema: noteUpdateSchema,
      responseEvent: WebSocketResponseEvents.NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.NOTE_DELETE,
      handler: handleNoteDelete,
      schema: noteDeleteSchema,
      responseEvent: WebSocketResponseEvents.NOTE_DELETED,
    },
  ],
});
