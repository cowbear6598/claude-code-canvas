import type { Command } from '../command.js';
import type { CommandNote } from '../commandNote.js';

export interface CommandListResultPayload {
  requestId: string;
  success: boolean;
  commands?: Command[];
  error?: string;
}

export interface CommandCreatedPayload {
  requestId: string;
  success: boolean;
  command?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface CommandUpdatedPayload {
  requestId: string;
  success: boolean;
  command?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface CommandReadResultPayload {
  requestId: string;
  success: boolean;
  command?: {
    id: string;
    name: string;
    content: string;
  };
  error?: string;
}

export interface CommandNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: CommandNote;
  error?: string;
}

export interface CommandNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: CommandNote[];
  error?: string;
}

export interface CommandNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: CommandNote;
  error?: string;
}

export interface CommandNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface CommandDeletedPayload {
  requestId: string;
  success: boolean;
  commandId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
