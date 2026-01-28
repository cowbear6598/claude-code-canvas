import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { gitCloneSchema } from '../../schemas/index.js';
import { handleGitClone } from '../gitHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const gitHandlerGroup: HandlerGroup = {
  name: 'git',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.POD_GIT_CLONE,
      handleGitClone,
      gitCloneSchema,
      WebSocketResponseEvents.POD_GIT_CLONE_RESULT
    ),
  ],
};
