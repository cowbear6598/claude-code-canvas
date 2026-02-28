import type { PodColor, PodStatus, ModelType } from './pod.js';
import type { AnchorPosition, ConnectionStatus } from './connection.js';
import type { PersistedScheduleConfig } from './schedule.js';

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
  id: string;
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
  lastUpdated: string;
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
  createdAt: string;
  updatedAt: string;
  x: number;
  y: number;
  rotation: number;
  claudeSessionId: string | null;
  outputStyleId: string | null;
  skillIds: string[];
  subAgentIds?: string[];
  mcpServerIds?: string[];
  model: ModelType;
  repositoryId: string | null;
  commandId?: string | null;
  needsForkSession?: boolean; // Flag to fork session on next query
  autoClear?: boolean; // Auto-clear messages after workflow completion
  schedule?: PersistedScheduleConfig; // Schedule configuration for automatic execution
}

/**
 * Connection data stored on disk
 */
export interface PersistedConnection {
  id: string;
  sourcePodId: string;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  triggerMode: 'auto' | 'ai-decide' | 'direct';
  decideStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'error';
  decideReason?: string | null;
  connectionStatus?: ConnectionStatus;
  createdAt: string;
}
