import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  skillListSchema,
  skillNoteCreateSchema,
  skillNoteListSchema,
  skillNoteUpdateSchema,
  skillNoteDeleteSchema,
  podBindSkillSchema,
} from '../../schemas/index.js';
import {
  handleSkillList,
  handleSkillNoteCreate,
  handleSkillNoteList,
  handleSkillNoteUpdate,
  handleSkillNoteDelete,
  handlePodBindSkill,
} from '../skillHandlers.js';
import type { HandlerGroup } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

export const skillHandlerGroup: HandlerGroup = {
  name: 'skill',
  handlers: [
    {
      event: WebSocketRequestEvents.SKILL_LIST,
      handler: handleSkillList as unknown as ValidatedHandler<unknown>,
      schema: skillListSchema,
      responseEvent: WebSocketResponseEvents.SKILL_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_CREATE,
      handler: handleSkillNoteCreate as unknown as ValidatedHandler<unknown>,
      schema: skillNoteCreateSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_LIST,
      handler: handleSkillNoteList as unknown as ValidatedHandler<unknown>,
      schema: skillNoteListSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_UPDATE,
      handler: handleSkillNoteUpdate as unknown as ValidatedHandler<unknown>,
      schema: skillNoteUpdateSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_DELETE,
      handler: handleSkillNoteDelete as unknown as ValidatedHandler<unknown>,
      schema: skillNoteDeleteSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_DELETED,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_SKILL,
      handler: handlePodBindSkill as unknown as ValidatedHandler<unknown>,
      schema: podBindSkillSchema,
      responseEvent: WebSocketResponseEvents.POD_SKILL_BOUND,
    },
  ],
};
