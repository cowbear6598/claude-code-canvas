import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
import {
  groupCreateSchema,
  groupListSchema,
  groupUpdateSchema,
  groupDeleteSchema,
} from '../../schemas/index.js';
import {
  handleGroupCreate,
  handleGroupList,
  handleGroupUpdate,
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
      event: WebSocketRequestEvents.GROUP_UPDATE,
      handler: handleGroupUpdate,
      schema: groupUpdateSchema,
      responseEvent: WebSocketResponseEvents.GROUP_UPDATED,
    },
    {
      event: WebSocketRequestEvents.GROUP_DELETE,
      handler: handleGroupDelete,
      schema: groupDeleteSchema,
      responseEvent: WebSocketResponseEvents.GROUP_DELETED,
    },
  ],
});
