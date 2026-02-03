import type { PodColor, PodStatus, ModelType } from './pod.js';
import type { AnchorPosition } from './connection.js';

export interface PersistedToolUseInfo {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'completed' | 'error';
}

export interface PersistedSubMessage {
  id: string;
  content: string;
  toolUse?: PersistedToolUseInfo[];
}

/**
 * Message stored in chat history
 */
export interface PersistedMessage {
  id: string; // Message UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601 format
  subMessages?: PersistedSubMessage[];
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
  skillIds: string[]; // Bound Skill IDs
  subAgentIds?: string[]; // Bound SubAgent IDs
  model: ModelType; // Model type for Claude API
  repositoryId: string | null; // Bound Repository ID
  commandId?: string | null; // Bound Command ID
  needsForkSession?: boolean; // Flag to fork session on next query
  autoClear?: boolean; // Auto-clear messages after workflow completion
}

/**
 * Connection data stored on disk
 */
export interface PersistedConnection {
  id: string;
  sourceType: 'pod' | 'trigger';
  sourcePodId: string;
  sourceTriggerId: string | null;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  autoTrigger: boolean;
  createdAt: string; // ISO 8601 format
}
