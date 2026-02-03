import { WebSocketResponseEvents } from '../schemas/index.js';
import { noteStore } from '../services/noteStores.js';
import { createNoteHandlers } from './factories/createNoteHandlers.js';

const noteHandlersImpl = createNoteHandlers({
  noteStore,
  events: {
    created: WebSocketResponseEvents.NOTE_CREATED,
    listResult: WebSocketResponseEvents.NOTE_LIST_RESULT,
    updated: WebSocketResponseEvents.NOTE_UPDATED,
    deleted: WebSocketResponseEvents.NOTE_DELETED,
  },
  broadcastEvents: {
    created: WebSocketResponseEvents.BROADCAST_NOTE_CREATED,
    updated: WebSocketResponseEvents.BROADCAST_NOTE_UPDATED,
    deleted: WebSocketResponseEvents.BROADCAST_NOTE_DELETED,
  },
  foreignKeyField: 'outputStyleId',
  entityName: 'OutputStyle',
});

export const handleNoteCreate = noteHandlersImpl.handleNoteCreate;
export const handleNoteList = noteHandlersImpl.handleNoteList;
export const handleNoteUpdate = noteHandlersImpl.handleNoteUpdate;
export const handleNoteDelete = noteHandlersImpl.handleNoteDelete;
