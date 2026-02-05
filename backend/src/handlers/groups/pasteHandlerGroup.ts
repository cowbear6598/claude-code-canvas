import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas';
import { canvasPasteSchema } from '../../schemas';
import { handleCanvasPaste } from '../pasteHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const pasteHandlerGroup = createHandlerGroup({
  name: 'paste',
  handlers: [
    {
      event: WebSocketRequestEvents.CANVAS_PASTE,
      handler: handleCanvasPaste,
      schema: canvasPasteSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
    },
  ],
});
