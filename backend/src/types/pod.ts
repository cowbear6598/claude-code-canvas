import type { ScheduleConfig } from './schedule.js';

export type PodStatus = 'idle' | 'chatting' | 'summarizing' | 'error';

export type ModelType = 'opus' | 'sonnet' | 'haiku';

export interface Pod {
  id: string;
  name: string;
  status: PodStatus;
  workspacePath: string;
  x: number;
  y: number;
  rotation: number;
  claudeSessionId: string | null;
  outputStyleId: string | null;
  skillIds: string[];
  subAgentIds: string[];
  mcpServerIds: string[];
  model: ModelType;
  repositoryId: string | null;
  commandId: string | null;
  autoClear: boolean;
  schedule?: ScheduleConfig;
}
