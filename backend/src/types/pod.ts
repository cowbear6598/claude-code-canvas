import type { ScheduleConfig } from './schedule.js';

export type PodColor = 'blue' | 'coral' | 'pink' | 'yellow' | 'green';

export type PodStatus = 'idle' | 'chatting' | 'summarizing' | 'error';

export type ModelType = 'opus' | 'sonnet' | 'haiku';

export interface Pod {
  id: string; // UUID
  name: string;
  color: PodColor;
  status: PodStatus;
  workspacePath: string; // path to git repo
  gitUrl: string | null; // cloned repository URL
  createdAt: Date;
  lastActiveAt: Date;
  // Canvas-specific fields
  x: number; // Canvas X position
  y: number; // Canvas Y position
  rotation: number; // Rotation angle
  // Claude session management
  claudeSessionId: string | null; // Claude SDK session ID for conversation resume
  outputStyleId: string | null; // Output style ID
  skillIds: string[]; // Bound Skill IDs
  subAgentIds: string[]; // Bound SubAgent IDs
  model: ModelType; // Model type for Claude API
  repositoryId: string | null; // Bound Repository ID
  commandId: string | null; // Bound Command ID
  needsForkSession: boolean; // Flag to fork session on next query (when cwd changes)
  autoClear: boolean; // Auto-clear messages after workflow completion
  schedule?: ScheduleConfig; // Schedule configuration for automatic execution
}
