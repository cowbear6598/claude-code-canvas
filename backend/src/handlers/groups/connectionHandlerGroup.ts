import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  connectionCreateSchema,
  connectionListSchema,
  connectionDeleteSchema,
  connectionUpdateSchema,
} from '../../schemas/index.js';
import {
  handleConnectionCreate,
  handleConnectionList,
  handleConnectionDelete,
  handleConnectionUpdate,
} from '../connectionHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const connectionHandlerGroup: HandlerGroup = {
  name: 'connection',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.CONNECTION_CREATE,
      handleConnectionCreate,
      connectionCreateSchema,
      WebSocketResponseEvents.CONNECTION_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CONNECTION_LIST,
      handleConnectionList,
      connectionListSchema,
      WebSocketResponseEvents.CONNECTION_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CONNECTION_DELETE,
      handleConnectionDelete,
      connectionDeleteSchema,
      WebSocketResponseEvents.CONNECTION_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CONNECTION_UPDATE,
      handleConnectionUpdate,
      connectionUpdateSchema,
      WebSocketResponseEvents.CONNECTION_UPDATED
    ),
  ],
};
