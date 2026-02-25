import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas';
import {
  groupCreateSchema,
  groupListSchema,
  groupDeleteSchema,
} from '../../schemas';
import {
  handleGroupCreate,
  handleGroupList,
  handleGroupDelete,
} from '../groupHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const groupHandlerGroup = createHandlerGroup({
  name: 'group',
  handlers: [
    {
      event: WebSocketRequestEvents.GROUP_CREATE,
      handler: handleGroupCreate,
      schema: groupCreateSchema,
      responseEvent: WebSocketResponseEvents.GROUP_CREATED,
    },
    {
      event: WebSocketRequestEvents.GROUP_LIST,
      handler: handleGroupList,
      schema: groupListSchema,
      responseEvent: WebSocketResponseEvents.GROUP_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.GROUP_DELETE,
      handler: handleGroupDelete,
      schema: groupDeleteSchema,
      responseEvent: WebSocketResponseEvents.GROUP_DELETED,
    },
  ],
});
