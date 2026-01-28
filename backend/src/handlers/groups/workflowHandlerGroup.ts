import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  workflowGetDownstreamPodsSchema,
  workflowClearSchema,
} from '../../schemas/index.js';
import {
  handleWorkflowGetDownstreamPods,
  handleWorkflowClear,
} from '../workflowHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const workflowHandlerGroup: HandlerGroup = {
  name: 'workflow',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
      handleWorkflowGetDownstreamPods,
      workflowGetDownstreamPodsSchema,
      WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.WORKFLOW_CLEAR,
      handleWorkflowClear,
      workflowClearSchema,
      WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT
    ),
  ],
};
