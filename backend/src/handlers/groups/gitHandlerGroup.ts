import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import { gitCloneSchema } from '../../schemas/index.js';
import { handleGitClone } from '../gitHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const gitHandlerGroup: HandlerGroup = {
  name: 'git',
  handlers: [
    {
      event: WebSocketRequestEvents.POD_GIT_CLONE,
      handler: handleGitClone as unknown as ValidatedHandler<unknown>,
      schema: gitCloneSchema,
      responseEvent: WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
    },
  ],
};
