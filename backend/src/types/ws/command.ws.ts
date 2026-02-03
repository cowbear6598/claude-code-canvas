export interface CommandListPayload {
  requestId: string;
  canvasId: string;
}

export interface CommandListResultPayload {
  requestId: string;
  success: boolean;
  commands?: import('../command.js').Command[];
  error?: string;
}

export interface CommandCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  content: string;
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

export interface CommandUpdatePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
  content: string;
}

export interface CommandUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
}

export interface CommandReadPayload {
  requestId: string;
  canvasId: string;
  commandId: string;
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

export interface CommandNoteCreatePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface CommandNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../commandNote.js').CommandNote;
  error?: string;
}

export interface CommandNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface CommandNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('../commandNote.js').CommandNote[];
  error?: string;
}

export interface CommandNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface CommandNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../commandNote.js').CommandNote;
  error?: string;
}

export interface CommandNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface CommandNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface CommandDeletePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
}

export interface CommandDeletedPayload {
  requestId: string;
  success: boolean;
  commandId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
