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
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const podHandlerGroup: HandlerGroup = {
  name: 'pod',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.POD_CREATE,
      handlePodCreate,
      podCreateSchema,
      WebSocketResponseEvents.POD_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_LIST,
      handlePodList,
      podListSchema,
      WebSocketResponseEvents.POD_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_GET,
      handlePodGet,
      podGetSchema,
      WebSocketResponseEvents.POD_GET_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_UPDATE,
      handlePodUpdate,
      podUpdateSchema,
      WebSocketResponseEvents.POD_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_DELETE,
      handlePodDelete,
      podDeleteSchema,
      WebSocketResponseEvents.POD_DELETED
    ),
  ],
};
