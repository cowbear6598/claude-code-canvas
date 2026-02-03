import type { RepositoryNote } from '../repositoryNote.js';

export interface RepositoryListResultPayload {
  requestId: string;
  success: boolean;
  repositories?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface RepositoryCreatedPayload {
  requestId: string;
  success: boolean;
  repository?: { id: string; name: string };
  error?: string;
}

export interface RepositoryNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: RepositoryNote;
  error?: string;
}

export interface RepositoryNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: RepositoryNote[];
  error?: string;
}

export interface RepositoryNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: RepositoryNote;
  error?: string;
}

export interface RepositoryNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface RepositoryDeletedPayload {
  requestId: string;
  success: boolean;
  repositoryId?: string;
  deletedNoteIds?: string[];
  error?: string;
}

export interface RepositoryGitCloneProgressPayload {
  requestId: string;
  progress: number;
  message: string;
}

export interface RepositoryGitCloneResultPayload {
  requestId: string;
  success: boolean;
  repository?: { id: string; name: string };
  error?: string;
}
