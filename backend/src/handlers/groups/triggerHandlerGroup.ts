import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  triggerCreateSchema,
  triggerListSchema,
  triggerUpdateSchema,
  triggerDeleteSchema,
} from '../../schemas/index.js';
import {
  handleTriggerCreate,
  handleTriggerList,
  handleTriggerUpdate,
  handleTriggerDelete,
} from '../triggerHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const triggerHandlerGroup: HandlerGroup = {
  name: 'trigger',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.TRIGGER_CREATE,
      handleTriggerCreate,
      triggerCreateSchema,
      WebSocketResponseEvents.TRIGGER_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.TRIGGER_LIST,
      handleTriggerList,
      triggerListSchema,
      WebSocketResponseEvents.TRIGGER_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.TRIGGER_UPDATE,
      handleTriggerUpdate,
      triggerUpdateSchema,
      WebSocketResponseEvents.TRIGGER_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.TRIGGER_DELETE,
      handleTriggerDelete,
      triggerDeleteSchema,
      WebSocketResponseEvents.TRIGGER_DELETED
    ),
  ],
};
