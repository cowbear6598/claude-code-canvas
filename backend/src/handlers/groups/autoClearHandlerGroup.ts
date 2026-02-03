import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { podSetAutoClearSchema } from '../../schemas/index.js';
import { handlePodSetAutoClear } from '../autoClearHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const autoClearHandlerGroup = createHandlerGroup({
  name: 'autoClear',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
      handler: handlePodSetAutoClear,
      schema: podSetAutoClearSchema,
      responseEvent: WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
    },
  ],
});
