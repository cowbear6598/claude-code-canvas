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
  repositoryDeleteSchema,
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
} from '../repositoryHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const repositoryHandlerGroup: HandlerGroup = {
  name: 'repository',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_LIST,
      handleRepositoryList,
      repositoryListSchema,
      WebSocketResponseEvents.REPOSITORY_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_CREATE,
      handleRepositoryCreate,
      repositoryCreateSchema,
      WebSocketResponseEvents.REPOSITORY_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
      handleRepositoryNoteCreate,
      repositoryNoteCreateSchema,
      WebSocketResponseEvents.REPOSITORY_NOTE_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
      handleRepositoryNoteList,
      repositoryNoteListSchema,
      WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
      handleRepositoryNoteUpdate,
      repositoryNoteUpdateSchema,
      WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
      handleRepositoryNoteDelete,
      repositoryNoteDeleteSchema,
      WebSocketResponseEvents.REPOSITORY_NOTE_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_BIND_REPOSITORY,
      handlePodBindRepository,
      podBindRepositorySchema,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
      handlePodUnbindRepository,
      podUnbindRepositorySchema,
      WebSocketResponseEvents.POD_REPOSITORY_UNBOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.REPOSITORY_DELETE,
      handleRepositoryDelete,
      repositoryDeleteSchema,
      WebSocketResponseEvents.REPOSITORY_DELETED
    ),
  ],
};
