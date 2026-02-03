import type { Pod } from '../pod.js';
import type { Connection } from '../connection.js';
import type { Trigger } from '../trigger.js';
import type { OutputStyleNote } from '../outputStyleNote.js';
import type { SkillNote } from '../skillNote.js';
import type { RepositoryNote } from '../repositoryNote.js';
import type { SubAgentNote } from '../subAgentNote.js';
import type { CommandNote } from '../commandNote.js';

export interface BroadcastPodCreatedPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodUpdatedPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodDeletedPayload {
  canvasId: string;
  podId: string;
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

export interface BroadcastTriggerCreatedPayload {
  canvasId: string;
  trigger: Trigger;
}

export interface BroadcastTriggerUpdatedPayload {
  canvasId: string;
  trigger: Trigger;
}

export interface BroadcastTriggerDeletedPayload {
  canvasId: string;
  triggerId: string;
  deletedConnectionIds: string[];
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

export interface BroadcastCanvasRenamedPayload {
  canvasId: string;
  newName: string;
}

export interface BroadcastCanvasDeletedPayload {
  canvasId: string;
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
