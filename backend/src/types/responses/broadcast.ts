import type { Pod, ModelType } from '../pod.js';
import type { Connection } from '../connection.js';
import type { OutputStyleNote } from '../outputStyleNote.js';
import type { SkillNote } from '../skillNote.js';
import type { RepositoryNote } from '../repositoryNote.js';
import type { SubAgentNote } from '../subAgentNote.js';
import type { CommandNote } from '../commandNote.js';
import type { ScheduleConfig } from '../schedule.js';

export interface BroadcastPodCreatedPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodMovedPayload {
  canvasId: string;
  podId: string;
  x: number;
  y: number;
}

export interface BroadcastPodRenamedPayload {
  canvasId: string;
  podId: string;
  name: string;
}

export interface BroadcastPodModelSetPayload {
  canvasId: string;
  podId: string;
  model: ModelType;
}

export interface BroadcastPodScheduleSetPayload {
  canvasId: string;
  podId: string;
  schedule: ScheduleConfig | null;
}

export interface BroadcastPodDeletedPayload {
  canvasId: string;
  podId: string;
  deletedNoteIds?: {
    note?: string[];
    skillNote?: string[];
    repositoryNote?: string[];
    commandNote?: string[];
    subAgentNote?: string[];
  };
}

export interface BroadcastConnectionCreatedPayload {
  canvasId: string;
  connection: Connection;
}

export interface BroadcastConnectionUpdatedPayload {
  canvasId: string;
  connection: Connection;
}

export interface BroadcastConnectionDeletedPayload {
  canvasId: string;
  connectionId: string;
}

export interface BroadcastRepositoryCreatedPayload {
  canvasId: string;
  repository: {
    id: string;
    name: string;
  };
}

export interface BroadcastPodOutputStyleBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodOutputStyleUnboundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodRepositoryBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodRepositoryUnboundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodSubAgentBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodAutoClearSetPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastCanvasCreatedPayload {
  canvas: {
    id: string;
    name: string;
    createdAt: string;
    sortIndex: number;
  };
}

export interface BroadcastCanvasRenamedPayload {
  canvasId: string;
  newName: string;
}

export interface BroadcastCanvasDeletedPayload {
  canvasId: string;
}

export interface BroadcastCanvasReorderedPayload {
  canvasIds: string[];
}

export interface BroadcastCanvasPastedPayload {
  canvasId: string;
  createdPods: Pod[];
  createdOutputStyleNotes: OutputStyleNote[];
  createdSkillNotes: SkillNote[];
  createdRepositoryNotes: RepositoryNote[];
  createdSubAgentNotes: SubAgentNote[];
  createdCommandNotes: CommandNote[];
  createdConnections: Connection[];
}

export interface BroadcastWorkflowClearResultPayload {
  canvasId: string;
  clearedPodIds: string[];
}

export interface BroadcastRepositoryBranchChangedPayload {
  canvasId: string;
  repositoryId: string;
  branchName: string;
}
