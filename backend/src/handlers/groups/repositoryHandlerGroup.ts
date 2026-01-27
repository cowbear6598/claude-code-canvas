import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  repositoryListSchema,
  repositoryCreateSchema,
  repositoryNoteCreateSchema,
  repositoryNoteListSchema,
  repositoryNoteUpdateSchema,
  repositoryNoteDeleteSchema,
  podBindRepositorySchema,
  podUnbindRepositorySchema,
} from '../../schemas/index.js';
import {
  handleRepositoryList,
  handleRepositoryCreate,
  handleRepositoryNoteCreate,
  handleRepositoryNoteList,
  handleRepositoryNoteUpdate,
  handleRepositoryNoteDelete,
  handlePodBindRepository,
  handlePodUnbindRepository,
} from '../repositoryHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const repositoryHandlerGroup: HandlerGroup = {
  name: 'repository',
  handlers: [
    {
      event: WebSocketRequestEvents.REPOSITORY_LIST,
      handler: handleRepositoryList as unknown as ValidatedHandler<unknown>,
      schema: repositoryListSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_CREATE,
      handler: handleRepositoryCreate as unknown as ValidatedHandler<unknown>,
      schema: repositoryCreateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
      handler: handleRepositoryNoteCreate as unknown as ValidatedHandler<unknown>,
      schema: repositoryNoteCreateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
      handler: handleRepositoryNoteList as unknown as ValidatedHandler<unknown>,
      schema: repositoryNoteListSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
      handler: handleRepositoryNoteUpdate as unknown as ValidatedHandler<unknown>,
      schema: repositoryNoteUpdateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
      handler: handleRepositoryNoteDelete as unknown as ValidatedHandler<unknown>,
      schema: repositoryNoteDeleteSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_REPOSITORY,
      handler: handlePodBindRepository as unknown as ValidatedHandler<unknown>,
      schema: podBindRepositorySchema,
      responseEvent: WebSocketResponseEvents.POD_REPOSITORY_BOUND,
    },
    {
      event: WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
      handler: handlePodUnbindRepository as unknown as ValidatedHandler<unknown>,
      schema: podUnbindRepositorySchema,
      responseEvent: WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
    },
  ],
};
