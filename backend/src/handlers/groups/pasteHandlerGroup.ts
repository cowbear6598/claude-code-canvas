import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { canvasPasteSchema } from '../../schemas/index.js';
import { handleCanvasPaste } from '../pasteHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const pasteHandlerGroup: HandlerGroup = {
  name: 'paste',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_PASTE,
      handleCanvasPaste,
      canvasPasteSchema,
      WebSocketResponseEvents.CANVAS_PASTE_RESULT
    ),
  ],
};
