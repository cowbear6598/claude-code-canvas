export interface NoteCreatePayload {
  requestId: string;
  canvasId: string;
  outputStyleId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface NoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface NoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface NoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface NoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../outputStyleNote.js').OutputStyleNote;
  error?: string;
}

export interface NoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('../outputStyleNote.js').OutputStyleNote[];
  error?: string;
}

export interface NoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../outputStyleNote.js').OutputStyleNote;
  error?: string;
}

export interface NoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}
