export interface SubAgentListPayload {
  requestId: string;
  canvasId: string;
}

export interface SubAgentListResultPayload {
  requestId: string;
  success: boolean;
  subAgents?: import('../subAgent.js').SubAgent[];
  error?: string;
}

export interface SubAgentCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  content: string;
}

export interface SubAgentCreatedPayload {
  requestId: string;
  success: boolean;
  subAgent?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface SubAgentUpdatePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
  content: string;
}

export interface SubAgentUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
}

export interface SubAgentReadPayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
}

export interface SubAgentReadResultPayload {
  requestId: string;
  success: boolean;
  subAgent?: {
    id: string;
    name: string;
    content: string;
  };
  error?: string;
}

export interface SubAgentNoteCreatePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface SubAgentNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../subAgentNote.js').SubAgentNote;
  error?: string;
}

export interface SubAgentNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface SubAgentNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('../subAgentNote.js').SubAgentNote[];
  error?: string;
}

export interface SubAgentNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface SubAgentNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('../subAgentNote.js').SubAgentNote;
  error?: string;
}

export interface SubAgentNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface SubAgentNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface SubAgentDeletePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
}

export interface SubAgentDeletedPayload {
  requestId: string;
  success: boolean;
  subAgentId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
