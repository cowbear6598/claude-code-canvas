import type { McpServer, McpServerConfig } from '../mcpServer.js';
import type { McpServerNote } from '../mcpServerNote.js';

export interface McpServerListResultPayload {
  requestId: string;
  success: boolean;
  mcpServers?: McpServer[];
  error?: string;
}

export interface McpServerCreatedPayload {
  requestId: string;
  success: boolean;
  mcpServer?: McpServer;
  error?: string;
}

export interface McpServerUpdatedPayload {
  requestId: string;
  success: boolean;
  mcpServer?: { id: string; name: string };
  error?: string;
}

export interface McpServerReadResultPayload {
  requestId: string;
  success: boolean;
  mcpServer?: { id: string; name: string; config: McpServerConfig };
  error?: string;
}

export interface McpServerDeletedPayload {
  requestId: string;
  success: boolean;
  mcpServerId?: string;
  deletedNoteIds?: string[];
  error?: string;
}

export interface McpServerNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: McpServerNote;
  error?: string;
}

export interface McpServerNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: McpServerNote[];
  error?: string;
}

export interface McpServerNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: McpServerNote;
  error?: string;
}

export interface McpServerNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}
