import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { chatSendSchema, chatHistorySchema } from '../../schemas/index.js';
import { handleChatSend, handleChatHistory } from '../chatHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const chatHandlerGroup: HandlerGroup = {
  name: 'chat',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_CHAT_SEND,
      handler: handleChatSend as unknown as ValidatedHandler<unknown>,
      schema: chatSendSchema,
      responseEvent: WebSocketResponseEvents.POD_ERROR,
    },
    {
      event: WebSocketRequestEvents.POD_CHAT_HISTORY,
      handler: handleChatHistory as unknown as ValidatedHandler<unknown>,
      schema: chatHistorySchema,
      responseEvent: WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
    },
  ],
};
