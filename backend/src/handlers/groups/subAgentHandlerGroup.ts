import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  subAgentListSchema,
  subAgentCreateSchema,
  subAgentUpdateSchema,
  subAgentReadSchema,
  subAgentNoteCreateSchema,
  subAgentNoteListSchema,
  subAgentNoteUpdateSchema,
  subAgentNoteDeleteSchema,
  podBindSubAgentSchema,
  subAgentDeleteSchema,
} from '../../schemas/index.js';
import {
  handleSubAgentList,
  handleSubAgentCreate,
  handleSubAgentUpdate,
  handleSubAgentRead,
  handleSubAgentNoteCreate,
  handleSubAgentNoteList,
  handleSubAgentNoteUpdate,
  handleSubAgentNoteDelete,
  handlePodBindSubAgent,
  handleSubAgentDelete,
} from '../subAgentHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const subAgentHandlerGroup: HandlerGroup = {
  name: 'subagent',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_LIST,
      handleSubAgentList,
      subAgentListSchema,
      WebSocketResponseEvents.SUBAGENT_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_CREATE,
      handleSubAgentCreate,
      subAgentCreateSchema,
      WebSocketResponseEvents.SUBAGENT_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_UPDATE,
      handleSubAgentUpdate,
      subAgentUpdateSchema,
      WebSocketResponseEvents.SUBAGENT_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_READ,
      handleSubAgentRead,
      subAgentReadSchema,
      WebSocketResponseEvents.SUBAGENT_READ_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      handleSubAgentNoteCreate,
      subAgentNoteCreateSchema,
      WebSocketResponseEvents.SUBAGENT_NOTE_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
      handleSubAgentNoteList,
      subAgentNoteListSchema,
      WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
      handleSubAgentNoteUpdate,
      subAgentNoteUpdateSchema,
      WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
      handleSubAgentNoteDelete,
      subAgentNoteDeleteSchema,
      WebSocketResponseEvents.SUBAGENT_NOTE_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_BIND_SUBAGENT,
      handlePodBindSubAgent,
      podBindSubAgentSchema,
      WebSocketResponseEvents.POD_SUBAGENT_BOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SUBAGENT_DELETE,
      handleSubAgentDelete,
      subAgentDeleteSchema,
      WebSocketResponseEvents.SUBAGENT_DELETED
    ),
  ],
};
