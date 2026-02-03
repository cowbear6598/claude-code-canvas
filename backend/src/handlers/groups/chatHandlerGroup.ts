import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { chatSendSchema, chatHistorySchema } from '../../schemas/index.js';
import { handleChatSend, handleChatHistory } from '../chatHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const chatHandlerGroup = createHandlerGroup({
  name: 'chat',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_CHAT_SEND,
      handler: handleChatSend,
      schema: chatSendSchema,
      responseEvent: WebSocketResponseEvents.POD_ERROR,
    },
    {
      event: WebSocketRequestEvents.POD_CHAT_HISTORY,
      handler: handleChatHistory,
      schema: chatHistorySchema,
      responseEvent: WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
    },
  ],
});
