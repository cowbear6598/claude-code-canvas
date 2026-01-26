import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  workflowGetDownstreamPodsSchema,
  workflowClearSchema,
} from '../../schemas/index.js';
import {
  handleWorkflowGetDownstreamPods,
  handleWorkflowClear,
} from '../workflowHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const workflowHandlerGroup: HandlerGroup = {
  name: 'workflow',
  handlers: [
    {
      event: WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
      handler: handleWorkflowGetDownstreamPods as unknown as ValidatedHandler<unknown>,
      schema: workflowGetDownstreamPodsSchema,
      responseEvent: WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
    },
    {
      event: WebSocketRequestEvents.WORKFLOW_CLEAR,
      handler: handleWorkflowClear as unknown as ValidatedHandler<unknown>,
      schema: workflowClearSchema,
      responseEvent: WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
    },
  ],
};
