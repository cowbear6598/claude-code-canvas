import type { Pod } from '../pod.js';

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
  connection: import('../connection.js').Connection;
}

export interface BroadcastConnectionUpdatedPayload {
  canvasId: string;
  connection: import('../connection.js').Connection;
}

export interface BroadcastConnectionDeletedPayload {
  canvasId: string;
  connectionId: string;
}

export interface BroadcastTriggerCreatedPayload {
  canvasId: string;
  trigger: import('../trigger.js').Trigger;
}

export interface BroadcastTriggerUpdatedPayload {
  canvasId: string;
  trigger: import('../trigger.js').Trigger;
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
  createdOutputStyleNotes: import('../outputStyleNote.js').OutputStyleNote[];
  createdSkillNotes: import('../skillNote.js').SkillNote[];
  createdRepositoryNotes: import('../repositoryNote.js').RepositoryNote[];
  createdSubAgentNotes: import('../subAgentNote.js').SubAgentNote[];
  createdCommandNotes: import('../commandNote.js').CommandNote[];
  createdConnections: import('../connection.js').Connection[];
}

export interface BroadcastWorkflowClearResultPayload {
  canvasId: string;
  clearedPodIds: string[];
}
