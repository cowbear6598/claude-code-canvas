import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { podSetAutoClearSchema } from '../../schemas/index.js';
import { handlePodSetAutoClear } from '../autoClearHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const autoClearHandlerGroup: HandlerGroup = {
  name: 'autoClear',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
      handler: handlePodSetAutoClear as unknown as ValidatedHandler<unknown>,
      schema: podSetAutoClearSchema,
      responseEvent: WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
    },
  ],
};
