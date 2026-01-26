import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  podCreateSchema,
  podListSchema,
  podGetSchema,
  podUpdateSchema,
  podDeleteSchema,
} from '../../schemas/index.js';
import {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodUpdate,
  handlePodDelete,
} from '../podHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const podHandlerGroup: HandlerGroup = {
  name: 'pod',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_CREATE,
      handler: handlePodCreate as unknown as ValidatedHandler<unknown>,
      schema: podCreateSchema,
      responseEvent: WebSocketResponseEvents.POD_CREATED,
    },
    {
      event: WebSocketRequestEvents.POD_LIST,
      handler: handlePodList as unknown as ValidatedHandler<unknown>,
      schema: podListSchema,
      responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_GET,
      handler: handlePodGet as unknown as ValidatedHandler<unknown>,
      schema: podGetSchema,
      responseEvent: WebSocketResponseEvents.POD_GET_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_UPDATE,
      handler: handlePodUpdate as unknown as ValidatedHandler<unknown>,
      schema: podUpdateSchema,
      responseEvent: WebSocketResponseEvents.POD_UPDATED,
    },
    {
      event: WebSocketRequestEvents.POD_DELETE,
      handler: handlePodDelete as unknown as ValidatedHandler<unknown>,
      schema: podDeleteSchema,
      responseEvent: WebSocketResponseEvents.POD_DELETED,
    },
  ],
};
