import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  commandListSchema,
  commandCreateSchema,
  commandUpdateSchema,
  commandReadSchema,
  commandNoteCreateSchema,
  commandNoteListSchema,
  commandNoteUpdateSchema,
  commandNoteDeleteSchema,
  podBindCommandSchema,
  podUnbindCommandSchema,
  commandDeleteSchema,
} from '../../schemas/index.js';
import {
  handleCommandList,
  handleCommandCreate,
  handleCommandUpdate,
  handleCommandRead,
  handleCommandNoteCreate,
  handleCommandNoteList,
  handleCommandNoteUpdate,
  handleCommandNoteDelete,
  handlePodBindCommand,
  handlePodUnbindCommand,
  handleCommandDelete,
} from '../commandHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const commandHandlerGroup: HandlerGroup = {
  name: 'command',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_LIST,
      handleCommandList,
      commandListSchema,
      WebSocketResponseEvents.COMMAND_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_CREATE,
      handleCommandCreate,
      commandCreateSchema,
      WebSocketResponseEvents.COMMAND_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_UPDATE,
      handleCommandUpdate,
      commandUpdateSchema,
      WebSocketResponseEvents.COMMAND_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_READ,
      handleCommandRead,
      commandReadSchema,
      WebSocketResponseEvents.COMMAND_READ_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_NOTE_CREATE,
      handleCommandNoteCreate,
      commandNoteCreateSchema,
      WebSocketResponseEvents.COMMAND_NOTE_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_NOTE_LIST,
      handleCommandNoteList,
      commandNoteListSchema,
      WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_NOTE_UPDATE,
      handleCommandNoteUpdate,
      commandNoteUpdateSchema,
      WebSocketResponseEvents.COMMAND_NOTE_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_NOTE_DELETE,
      handleCommandNoteDelete,
      commandNoteDeleteSchema,
      WebSocketResponseEvents.COMMAND_NOTE_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_BIND_COMMAND,
      handlePodBindCommand,
      podBindCommandSchema,
      WebSocketResponseEvents.POD_COMMAND_BOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_UNBIND_COMMAND,
      handlePodUnbindCommand,
      podUnbindCommandSchema,
      WebSocketResponseEvents.POD_COMMAND_UNBOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.COMMAND_DELETE,
      handleCommandDelete,
      commandDeleteSchema,
      WebSocketResponseEvents.COMMAND_DELETED
    ),
  ],
};
