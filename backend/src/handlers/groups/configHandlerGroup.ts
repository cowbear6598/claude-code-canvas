import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas';
import { configGetSchema, configUpdateSchema } from '../../schemas';
import { handleConfigGet, handleConfigUpdate } from '../configHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const configHandlerGroup = createHandlerGroup({
  name: 'config',
  handlers: [
    {
      event: WebSocketRequestEvents.CONFIG_GET,
      handler: handleConfigGet,
      schema: configGetSchema,
      responseEvent: WebSocketResponseEvents.CONFIG_GET_RESULT,
    },
    {
      event: WebSocketRequestEvents.CONFIG_UPDATE,
      handler: handleConfigUpdate,
      schema: configUpdateSchema,
      responseEvent: WebSocketResponseEvents.CONFIG_UPDATED,
    },
  ],
});
