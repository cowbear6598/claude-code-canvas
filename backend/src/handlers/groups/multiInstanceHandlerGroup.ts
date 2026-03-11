import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas';
import { podSetMultiInstanceSchema } from '../../schemas';
import { handlePodSetMultiInstance } from '../multiInstanceHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const multiInstanceHandlerGroup = createHandlerGroup({
  name: 'multiInstance',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_SET_MULTI_INSTANCE,
      handler: handlePodSetMultiInstance,
      schema: podSetMultiInstanceSchema,
      responseEvent: WebSocketResponseEvents.POD_MULTI_INSTANCE_SET,
    },
  ],
});
