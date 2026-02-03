import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../schemas/index.js';
import {
  skillListSchema,
  skillNoteCreateSchema,
  skillNoteListSchema,
  skillNoteUpdateSchema,
  skillNoteDeleteSchema,
  podBindSkillSchema,
  skillDeleteSchema,
} from '../../schemas/index.js';
import {
  handleSkillList,
  handleSkillNoteCreate,
  handleSkillNoteList,
  handleSkillNoteUpdate,
  handleSkillNoteDelete,
  handlePodBindSkill,
  handleSkillDelete,
} from '../skillHandlers.js';
import { createHandlerGroup } from './createHandlerGroup.js';

export const skillHandlerGroup = createHandlerGroup({
  name: 'skill',
  handlers: [
    {
      event: WebSocketRequestEvents.SKILL_LIST,
      handler: handleSkillList,
      schema: skillListSchema,
      responseEvent: WebSocketResponseEvents.SKILL_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_CREATE,
      handler: handleSkillNoteCreate,
      schema: skillNoteCreateSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_CREATED,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_LIST,
      handler: handleSkillNoteList,
      schema: skillNoteListSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_UPDATE,
      handler: handleSkillNoteUpdate,
      schema: skillNoteUpdateSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
    },
    {
      event: WebSocketRequestEvents.SKILL_NOTE_DELETE,
      handler: handleSkillNoteDelete,
      schema: skillNoteDeleteSchema,
      responseEvent: WebSocketResponseEvents.SKILL_NOTE_DELETED,
    },
    {
      event: WebSocketRequestEvents.POD_BIND_SKILL,
      handler: handlePodBindSkill,
      schema: podBindSkillSchema,
      responseEvent: WebSocketResponseEvents.POD_SKILL_BOUND,
    },
    {
      event: WebSocketRequestEvents.SKILL_DELETE,
      handler: handleSkillDelete,
      schema: skillDeleteSchema,
      responseEvent: WebSocketResponseEvents.SKILL_DELETED,
    },
  ],
});
