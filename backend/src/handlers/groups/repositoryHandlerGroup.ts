import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
import {
  repositoryListSchema,
  repositoryCreateSchema,
  repositoryNoteCreateSchema,
  repositoryNoteListSchema,
  repositoryNoteUpdateSchema,
  repositoryNoteDeleteSchema,
  podBindRepositorySchema,
  podUnbindRepositorySchema,
  repositoryDeleteSchema,
  repositoryGitCloneSchema,
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
  handleRepositoryDelete,
  handleRepositoryGitClone,
} from '../repositoryHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const repositoryHandlerGroup = createHandlerGroup({
  name: 'repository',
  handlers: [
    {
      event: WebSocketRequestEvents.REPOSITORY_LIST,
      handler: handleRepositoryList,
      schema: repositoryListSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_CREATE,
      handler: handleRepositoryCreate,
      schema: repositoryCreateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
      handler: handleRepositoryNoteCreate,
      schema: repositoryNoteCreateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
      handler: handleRepositoryNoteList,
      schema: repositoryNoteListSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
      handler: handleRepositoryNoteUpdate,
      schema: repositoryNoteUpdateSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
      handler: handleRepositoryNoteDelete,
      schema: repositoryNoteDeleteSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_REPOSITORY,
      handler: handlePodBindRepository,
      schema: podBindRepositorySchema,
      responseEvent: WebSocketResponseEvents.POD_REPOSITORY_BOUND,
    },
    {
      event: WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
      handler: handlePodUnbindRepository,
      schema: podUnbindRepositorySchema,
      responseEvent: WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_DELETE,
      handler: handleRepositoryDelete,
      schema: repositoryDeleteSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_DELETED,
    },
    {
      event: WebSocketRequestEvents.REPOSITORY_GIT_CLONE,
      handler: handleRepositoryGitClone,
      schema: repositoryGitCloneSchema,
      responseEvent: WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
    },
  ],
});
