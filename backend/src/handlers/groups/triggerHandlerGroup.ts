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
import { createHandlerGroup } from './createHandlerGroup.js';

export const triggerHandlerGroup = createHandlerGroup({
  name: 'trigger',
  handlers: [
    {
      event: WebSocketRequestEvents.TRIGGER_CREATE,
      handler: handleTriggerCreate,
      schema: triggerCreateSchema,
      responseEvent: WebSocketResponseEvents.TRIGGER_CREATED,
    },
    {
      event: WebSocketRequestEvents.TRIGGER_LIST,
      handler: handleTriggerList,
      schema: triggerListSchema,
      responseEvent: WebSocketResponseEvents.TRIGGER_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.TRIGGER_UPDATE,
      handler: handleTriggerUpdate,
      schema: triggerUpdateSchema,
      responseEvent: WebSocketResponseEvents.TRIGGER_UPDATED,
    },
    {
      event: WebSocketRequestEvents.TRIGGER_DELETE,
      handler: handleTriggerDelete,
      schema: triggerDeleteSchema,
      responseEvent: WebSocketResponseEvents.TRIGGER_DELETED,
    },
  ],
});
