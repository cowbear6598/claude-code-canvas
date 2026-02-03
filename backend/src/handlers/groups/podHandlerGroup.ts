import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
import {
  podCreateSchema,
  podListSchema,
  podGetSchema,
  podMoveSchema,
  podRenameSchema,
  podSetModelSchema,
  podSetScheduleSchema,
  podDeleteSchema,
} from '../../schemas/index.js';
import {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodMove,
  handlePodRename,
  handlePodSetModel,
  handlePodSetSchedule,
  handlePodDelete,
} from '../podHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const podHandlerGroup = createHandlerGroup({
  name: 'pod',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_CREATE,
      handler: handlePodCreate,
      schema: podCreateSchema,
      responseEvent: WebSocketResponseEvents.POD_CREATED,
    },
    {
      event: WebSocketRequestEvents.POD_LIST,
      handler: handlePodList,
      schema: podListSchema,
      responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_GET,
      handler: handlePodGet,
      schema: podGetSchema,
      responseEvent: WebSocketResponseEvents.POD_GET_RESULT,
    },
    {
      event: WebSocketRequestEvents.POD_MOVE,
      handler: handlePodMove,
      schema: podMoveSchema,
      responseEvent: WebSocketResponseEvents.POD_MOVED,
    },
    {
      event: WebSocketRequestEvents.POD_RENAME,
      handler: handlePodRename,
      schema: podRenameSchema,
      responseEvent: WebSocketResponseEvents.POD_RENAMED,
    },
    {
      event: WebSocketRequestEvents.POD_SET_MODEL,
      handler: handlePodSetModel,
      schema: podSetModelSchema,
      responseEvent: WebSocketResponseEvents.POD_MODEL_SET,
    },
    {
      event: WebSocketRequestEvents.POD_SET_SCHEDULE,
      handler: handlePodSetSchedule,
      schema: podSetScheduleSchema,
      responseEvent: WebSocketResponseEvents.POD_SCHEDULE_SET,
    },
    {
      event: WebSocketRequestEvents.POD_DELETE,
      handler: handlePodDelete,
      schema: podDeleteSchema,
      responseEvent: WebSocketResponseEvents.POD_DELETED,
    },
  ],
});
