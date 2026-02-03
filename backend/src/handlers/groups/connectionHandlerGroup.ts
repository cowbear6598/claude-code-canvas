import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
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
import { createHandlerGroup } from './createHandlerGroup.js';

export const connectionHandlerGroup = createHandlerGroup({
  name: 'connection',
  handlers: [
    {
      event: WebSocketRequestEvents.CONNECTION_CREATE,
      handler: handleConnectionCreate,
      schema: connectionCreateSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_CREATED,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_LIST,
      handler: handleConnectionList,
      schema: connectionListSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_DELETE,
      handler: handleConnectionDelete,
      schema: connectionDeleteSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_DELETED,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_UPDATE,
      handler: handleConnectionUpdate,
      schema: connectionUpdateSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_UPDATED,
    },
  ],
});
