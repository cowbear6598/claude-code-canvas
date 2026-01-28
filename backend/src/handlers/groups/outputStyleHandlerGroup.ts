import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  outputStyleListSchema,
  podBindOutputStyleSchema,
  podUnbindOutputStyleSchema,
  outputStyleDeleteSchema,
} from '../../schemas/index.js';
import {
  handleOutputStyleList,
  handlePodBindOutputStyle,
  handlePodUnbindOutputStyle,
  handleOutputStyleDelete,
} from '../outputStyleHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const outputStyleHandlerGroup: HandlerGroup = {
  name: 'outputStyle',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.OUTPUT_STYLE_LIST,
      handleOutputStyleList,
      outputStyleListSchema,
      WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
      handlePodBindOutputStyle,
      podBindOutputStyleSchema,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
      handlePodUnbindOutputStyle,
      podUnbindOutputStyleSchema,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
      handleOutputStyleDelete,
      outputStyleDeleteSchema,
      WebSocketResponseEvents.OUTPUT_STYLE_DELETED
    ),
  ],
};
