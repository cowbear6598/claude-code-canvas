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
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const connectionHandlerGroup: HandlerGroup = {
  name: 'connection',
  handlers: [
    {
      event: WebSocketRequestEvents.CONNECTION_CREATE,
      handler: handleConnectionCreate as unknown as ValidatedHandler<unknown>,
      schema: connectionCreateSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_CREATED,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_LIST,
      handler: handleConnectionList as unknown as ValidatedHandler<unknown>,
      schema: connectionListSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_DELETE,
      handler: handleConnectionDelete as unknown as ValidatedHandler<unknown>,
      schema: connectionDeleteSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_DELETED,
    },
    {
      event: WebSocketRequestEvents.CONNECTION_UPDATE,
      handler: handleConnectionUpdate as unknown as ValidatedHandler<unknown>,
      schema: connectionUpdateSchema,
      responseEvent: WebSocketResponseEvents.CONNECTION_UPDATED,
    },
  ],
};
