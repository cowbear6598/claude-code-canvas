import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { chatSendSchema, chatHistorySchema } from '../../schemas/index.js';
import { handleChatSend, handleChatHistory } from '../chatHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const chatHandlerGroup: HandlerGroup = {
  name: 'chat',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.POD_CHAT_SEND,
      handleChatSend,
      chatSendSchema,
      WebSocketResponseEvents.POD_ERROR
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_CHAT_HISTORY,
      handleChatHistory,
      chatHistorySchema,
      WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT
    ),
  ],
};
