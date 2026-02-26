import type { ScheduleConfig } from './schedule.js';

export type PodColor = 'blue' | 'coral' | 'pink' | 'yellow' | 'green';

export type PodStatus = 'idle' | 'chatting' | 'summarizing' | 'error';

export type ModelType = 'opus' | 'sonnet' | 'haiku';

export interface Pod {
  id: string;
  name: string;
  color: PodColor;
  status: PodStatus;
  workspacePath: string;
  gitUrl: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  x: number;
  y: number;
  rotation: number;
  claudeSessionId: string | null;
  outputStyleId: string | null;
  skillIds: string[];
  subAgentIds: string[];
  model: ModelType;
  repositoryId: string | null;
  commandId: string | null;
  needsForkSession: boolean; // Flag to fork session on next query (when cwd changes)
  autoClear: boolean; // Auto-clear messages after workflow completion
  schedule?: ScheduleConfig; // Schedule configuration for automatic execution
}
