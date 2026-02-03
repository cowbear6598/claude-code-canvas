import type { Skill } from '../skill.js';
import type { SkillNote } from '../skillNote.js';

export interface SkillListResultPayload {
  requestId: string;
  success: boolean;
  skills?: Skill[];
  error?: string;
}

export interface SkillNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: SkillNote;
  error?: string;
}

export interface SkillNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: SkillNote[];
  error?: string;
}

export interface SkillNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: SkillNote;
  error?: string;
}

export interface SkillNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface SkillDeletedPayload {
  requestId: string;
  success: boolean;
  skillId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
