import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
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
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const skillHandlerGroup: HandlerGroup = {
  name: 'skill',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_LIST,
      handleSkillList,
      skillListSchema,
      WebSocketResponseEvents.SKILL_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_NOTE_CREATE,
      handleSkillNoteCreate,
      skillNoteCreateSchema,
      WebSocketResponseEvents.SKILL_NOTE_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_NOTE_LIST,
      handleSkillNoteList,
      skillNoteListSchema,
      WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_NOTE_UPDATE,
      handleSkillNoteUpdate,
      skillNoteUpdateSchema,
      WebSocketResponseEvents.SKILL_NOTE_UPDATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_NOTE_DELETE,
      handleSkillNoteDelete,
      skillNoteDeleteSchema,
      WebSocketResponseEvents.SKILL_NOTE_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.POD_BIND_SKILL,
      handlePodBindSkill,
      podBindSkillSchema,
      WebSocketResponseEvents.POD_SKILL_BOUND
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.SKILL_DELETE,
      handleSkillDelete,
      skillDeleteSchema,
      WebSocketResponseEvents.SKILL_DELETED
    ),
  ],
};
