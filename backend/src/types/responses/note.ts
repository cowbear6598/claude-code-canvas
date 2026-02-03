import type { OutputStyleNote } from '../outputStyleNote.js';

export interface NoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: OutputStyleNote;
  error?: string;
}

export interface NoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: OutputStyleNote[];
  error?: string;
}

export interface NoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: OutputStyleNote;
  error?: string;
}

export interface NoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}
