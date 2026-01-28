import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { podSetAutoClearSchema } from '../../schemas/index.js';
import { handlePodSetAutoClear } from '../autoClearHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const autoClearHandlerGroup: HandlerGroup = {
  name: 'autoClear',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
      handlePodSetAutoClear,
      podSetAutoClearSchema,
      WebSocketResponseEvents.POD_AUTO_CLEAR_SET
    ),
  ],
};
