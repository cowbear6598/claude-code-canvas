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
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const outputStyleHandlerGroup: HandlerGroup = {
  name: 'outputStyle',
  handlers: [
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_LIST,
      handler: handleOutputStyleList as unknown as ValidatedHandler<unknown>,
      schema: outputStyleListSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
      handler: handlePodBindOutputStyle as unknown as ValidatedHandler<unknown>,
      schema: podBindOutputStyleSchema,
      responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
    },
    {
      event: WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
      handler: handlePodUnbindOutputStyle as unknown as ValidatedHandler<unknown>,
      schema: podUnbindOutputStyleSchema,
      responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
    },
    {
      event: WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
      handler: handleOutputStyleDelete as unknown as ValidatedHandler<unknown>,
      schema: outputStyleDeleteSchema,
      responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
    },
  ],
};
