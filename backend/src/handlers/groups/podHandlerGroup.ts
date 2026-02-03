import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
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
import { createHandlerGroup } from './createHandlerGroup.js';

export const podHandlerGroup = createHandlerGroup({
  name: 'pod',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_CREATE,
      handler: handlePodCreate,
      schema: podCreateSchema,
      responseEvent: WebSocketResponseEvents.POD_CREATED,
    },
    {
      event: WebSocketRequestEvents.POD_LIST,
      handler: handlePodList,
      schema: podListSchema,
      responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_GET,
      handler: handlePodGet,
      schema: podGetSchema,
      responseEvent: WebSocketResponseEvents.POD_GET_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_UPDATE,
      handler: handlePodUpdate,
      schema: podUpdateSchema,
      responseEvent: WebSocketResponseEvents.POD_UPDATED,
    },
    {
      event: WebSocketRequestEvents.POD_DELETE,
      handler: handlePodDelete,
      schema: podDeleteSchema,
      responseEvent: WebSocketResponseEvents.POD_DELETED,
    },
  ],
});
