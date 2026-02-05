import type { SubAgent } from '../subAgent.js';
import type { SubAgentNote } from '../subAgentNote.js';

export interface SubAgentListResultPayload {
  requestId: string;
  success: boolean;
  subAgents?: SubAgent[];
  error?: string;
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

export interface SubAgentUpdatedPayload {
  requestId: string;
  success: boolean;
  subAgent?: {
    id: string;
    name: string;
  };
  error?: string;
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

export interface SubAgentNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: SubAgentNote;
  error?: string;
}

export interface SubAgentNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: SubAgentNote[];
  error?: string;
}

export interface SubAgentNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: SubAgentNote;
  error?: string;
}

export interface SubAgentNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface SubAgentDeletedPayload {
  requestId: string;
  success: boolean;
  subAgentId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
