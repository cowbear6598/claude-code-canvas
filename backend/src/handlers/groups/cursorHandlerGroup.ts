import { WebSocketRequestEvents } from '../../schemas';
import { cursorMoveSchema } from '../../schemas';
import { handleCursorMove } from '../cursorHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const cursorHandlerGroup = createHandlerGroup({
  name: 'cursor',
  handlers: [
    {
      event: WebSocketRequestEvents.CURSOR_MOVE,
      handler: handleCursorMove,
      schema: cursorMoveSchema,
      responseEvent: 'error',
    },
  ],
});
