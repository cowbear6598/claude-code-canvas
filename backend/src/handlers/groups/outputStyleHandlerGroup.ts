import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  outputStyleListSchema,
  outputStyleCreateSchema,
  outputStyleUpdateSchema,
  outputStyleReadSchema,
  podBindOutputStyleSchema,
  podUnbindOutputStyleSchema,
  outputStyleDeleteSchema,
} from '../../schemas/index.js';
import {
  handleOutputStyleList,
  handleOutputStyleCreate,
  handleOutputStyleUpdate,
  handleOutputStyleRead,
  handlePodBindOutputStyle,
  handlePodUnbindOutputStyle,
  handleOutputStyleDelete,
} from '../outputStyleHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const outputStyleHandlerGroup = createHandlerGroup({
  name: 'outputStyle',
  handlers: [
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_LIST,
      handler: handleOutputStyleList,
      schema: outputStyleListSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_CREATE,
      handler: handleOutputStyleCreate,
      schema: outputStyleCreateSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    },
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_UPDATE,
      handler: handleOutputStyleUpdate,
      schema: outputStyleUpdateSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_READ,
      handler: handleOutputStyleRead,
      schema: outputStyleReadSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
      handler: handlePodBindOutputStyle,
      schema: podBindOutputStyleSchema,
      responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
    },
    {
      event: WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
      handler: handlePodUnbindOutputStyle,
      schema: podUnbindOutputStyleSchema,
      responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
    },
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
      handler: handleOutputStyleDelete,
      schema: outputStyleDeleteSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
    },
  ],
});
