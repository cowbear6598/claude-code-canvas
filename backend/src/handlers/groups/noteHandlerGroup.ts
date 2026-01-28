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
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const noteHandlerGroup: HandlerGroup = {
  name: 'note',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.NOTE_CREATE,
      handleNoteCreate,
      noteCreateSchema,
      WebSocketResponseEvents.NOTE_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.NOTE_LIST,
      handleNoteList,
      noteListSchema,
      WebSocketResponseEvents.NOTE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.NOTE_UPDATE,
      handleNoteUpdate,
      noteUpdateSchema,
      WebSocketResponseEvents.NOTE_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.NOTE_DELETE,
      handleNoteDelete,
      noteDeleteSchema,
      WebSocketResponseEvents.NOTE_DELETED
    ),
  ],
};
