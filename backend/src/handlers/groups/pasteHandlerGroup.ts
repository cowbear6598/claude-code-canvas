import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { canvasPasteSchema } from '../../schemas/index.js';
import { handleCanvasPaste } from '../pasteHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const pasteHandlerGroup: HandlerGroup = {
  name: 'paste',
  handlers: [
    {
      event: WebSocketRequestEvents.CANVAS_PASTE,
      handler: handleCanvasPaste as unknown as ValidatedHandler<unknown>,
      schema: canvasPasteSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
    },
  ],
};
