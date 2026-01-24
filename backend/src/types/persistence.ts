// Persistence Type Definitions
// Types for data stored on disk

import type { PodTypeName, PodColor, PodStatus } from './pod.js';

/**
 * Message stored in chat history
 */
export interface PersistedMessage {
  id: string; // Message UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601 format
}

/**
 * Chat history for a Pod
 */
export interface ChatHistory {
  messages: PersistedMessage[];
  lastUpdated: string; // ISO 8601 format
}

/**
 * Pod data stored on disk
 */
export interface PersistedPod {
  id: string;
  name: string;
  type: PodTypeName;
  color: PodColor;
  status: PodStatus;
  gitUrl: string | null;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  // Canvas-specific fields
  x: number;
  y: number;
  rotation: number;
  // Claude session management
  claudeSessionId: string | null; // Claude SDK session ID for resume
  outputStyleId: string | null; // Output style ID
}
