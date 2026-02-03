export interface RepositoryListPayload {
  requestId: string;
  canvasId: string;
}

export interface RepositoryListResultPayload {
  requestId: string;
  success: boolean;
  repositories?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface RepositoryCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
}

export interface RepositoryCreatedPayload {
  requestId: string;
  success: boolean;
  repository?: { id: string; name: string };
  error?: string;
}

export interface RepositoryNoteCreatePayload {
  requestId: string;
  canvasId: string;
  repositoryId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface RepositoryNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../repositoryNote.js').RepositoryNote;
  error?: string;
}

export interface RepositoryNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface RepositoryNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('../repositoryNote.js').RepositoryNote[];
  error?: string;
}

export interface RepositoryNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface RepositoryNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../repositoryNote.js').RepositoryNote;
  error?: string;
}

export interface RepositoryNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface RepositoryNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface RepositoryDeletePayload {
  requestId: string;
  canvasId: string;
  repositoryId: string;
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
