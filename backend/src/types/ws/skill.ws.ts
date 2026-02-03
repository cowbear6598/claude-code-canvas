export interface SkillListPayload {
  requestId: string;
  canvasId: string;
}

export interface SkillNoteCreatePayload {
  requestId: string;
  canvasId: string;
  skillId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface SkillNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface SkillNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface SkillNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface SkillListResultPayload {
  requestId: string;
  success: boolean;
  skills?: import('../skill.js').Skill[];
  error?: string;
}

export interface SkillNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../skillNote.js').SkillNote;
  error?: string;
}

export interface SkillNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('../skillNote.js').SkillNote[];
  error?: string;
}

export interface SkillNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../skillNote.js').SkillNote;
  error?: string;
}

export interface SkillNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface SkillDeletePayload {
  requestId: string;
  canvasId: string;
  skillId: string;
}

export interface SkillDeletedPayload {
  requestId: string;
  success: boolean;
  skillId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
