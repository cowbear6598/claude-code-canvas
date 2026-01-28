import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  subAgentListSchema,
  subAgentNoteCreateSchema,
  subAgentNoteListSchema,
  subAgentNoteUpdateSchema,
  subAgentNoteDeleteSchema,
  podBindSubAgentSchema,
  subAgentDeleteSchema,
} from '../../schemas/index.js';
import {
  handleSubAgentList,
  handleSubAgentNoteCreate,
  handleSubAgentNoteList,
  handleSubAgentNoteUpdate,
  handleSubAgentNoteDelete,
  handlePodBindSubAgent,
  handleSubAgentDelete,
} from '../subAgentHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const subAgentHandlerGroup: HandlerGroup = {
  name: 'subagent',
  handlers: [
    {
      event: WebSocketRequestEvents.SUBAGENT_LIST,
      handler: handleSubAgentList as unknown as ValidatedHandler<unknown>,
      schema: subAgentListSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      handler: handleSubAgentNoteCreate as unknown as ValidatedHandler<unknown>,
      schema: subAgentNoteCreateSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
      handler: handleSubAgentNoteList as unknown as ValidatedHandler<unknown>,
      schema: subAgentNoteListSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
      handler: handleSubAgentNoteUpdate as unknown as ValidatedHandler<unknown>,
      schema: subAgentNoteUpdateSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
      handler: handleSubAgentNoteDelete as unknown as ValidatedHandler<unknown>,
      schema: subAgentNoteDeleteSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_SUBAGENT,
      handler: handlePodBindSubAgent as unknown as ValidatedHandler<unknown>,
      schema: podBindSubAgentSchema,
      responseEvent: WebSocketResponseEvents.POD_SUBAGENT_BOUND,
    },
    {
      event: WebSocketRequestEvents.SUBAGENT_DELETE,
      handler: handleSubAgentDelete as unknown as ValidatedHandler<unknown>,
      schema: subAgentDeleteSchema,
      responseEvent: WebSocketResponseEvents.SUBAGENT_DELETED,
    },
  ],
};
