import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas';
import {
  workflowGetDownstreamPodsSchema,
  workflowClearSchema,
} from '../../schemas';
import {
  handleWorkflowGetDownstreamPods,
  handleWorkflowClear,
} from '../workflowHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const workflowHandlerGroup = createHandlerGroup({
  name: 'workflow',
  handlers: [
    {
      event: WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
      handler: handleWorkflowGetDownstreamPods,
      schema: workflowGetDownstreamPodsSchema,
      responseEvent: WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
    },
    {
      event: WebSocketRequestEvents.WORKFLOW_CLEAR,
      handler: handleWorkflowClear,
      schema: workflowClearSchema,
      responseEvent: WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
    },
  ],
});
