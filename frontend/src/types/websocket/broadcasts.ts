import type {Pod} from '@/types'
import type {Connection} from '@/types/connection'
import type {Trigger} from '@/types/trigger'

export interface BroadcastPodCreatedPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodUpdatedPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodDeletedPayload {
  canvasId: string
  podId: string
}

export interface BroadcastConnectionCreatedPayload {
  canvasId: string
  connection: Connection
}

export interface BroadcastConnectionUpdatedPayload {
  canvasId: string
  connection: Connection
}

export interface BroadcastConnectionDeletedPayload {
  canvasId: string
  connectionId: string
}

export interface BroadcastTriggerCreatedPayload {
  canvasId: string
  trigger: Trigger
}

export interface BroadcastTriggerUpdatedPayload {
  canvasId: string
  trigger: Trigger
}

export interface BroadcastTriggerDeletedPayload {
  canvasId: string
  triggerId: string
  deletedConnectionIds?: string[]
}

export interface BroadcastOutputStyleCreatedPayload {
  canvasId: string
  outputStyle: {
    id: string
    name: string
  }
}

export interface BroadcastOutputStyleUpdatedPayload {
  canvasId: string
  outputStyleId: string
}

export interface BroadcastOutputStyleDeletedPayload {
  canvasId: string
  outputStyleId: string
  deletedNoteIds?: string[]
}

export interface BroadcastNoteCreatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastNoteUpdatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastSkillNoteCreatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastSkillNoteUpdatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastSkillNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastSkillDeletedPayload {
  canvasId: string
  skillId: string
  deletedNoteIds?: string[]
}

export interface BroadcastRepositoryNoteCreatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastRepositoryNoteUpdatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastRepositoryNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastRepositoryCreatedPayload {
  canvasId: string
  repository: Record<string, unknown>
}

export interface BroadcastRepositoryDeletedPayload {
  canvasId: string
  repositoryId: string
  deletedNoteIds?: string[]
}

export interface BroadcastSubAgentNoteCreatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastSubAgentNoteUpdatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastSubAgentNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastSubAgentCreatedPayload {
  canvasId: string
  subAgent: Record<string, unknown>
}

export interface BroadcastSubAgentUpdatedPayload {
  canvasId: string
  subAgentId: string
}

export interface BroadcastSubAgentDeletedPayload {
  canvasId: string
  subAgentId: string
  deletedNoteIds?: string[]
}

export interface BroadcastCommandNoteCreatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastCommandNoteUpdatedPayload {
  canvasId: string
  note: Record<string, unknown>
}

export interface BroadcastCommandNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastCommandCreatedPayload {
  canvasId: string
  command: Record<string, unknown>
}

export interface BroadcastCommandUpdatedPayload {
  canvasId: string
  commandId: string
}

export interface BroadcastCommandDeletedPayload {
  canvasId: string
  commandId: string
  deletedNoteIds?: string[]
}

export interface BroadcastPodOutputStyleBoundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodOutputStyleUnboundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodSkillBoundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodRepositoryBoundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodRepositoryUnboundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodSubAgentBoundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodCommandBoundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodCommandUnboundPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastPodAutoClearSetPayload {
  canvasId: string
  pod: Pod
}

export interface BroadcastCanvasRenamedPayload {
  canvasId: string
  newName: string
}

export interface BroadcastCanvasDeletedPayload {
  canvasId: string
}

export interface BroadcastCanvasPastedPayload {
  canvasId: string
  createdPods?: Pod[]
  createdOutputStyleNotes?: Record<string, unknown>[]
  createdSkillNotes?: Record<string, unknown>[]
  createdRepositoryNotes?: Record<string, unknown>[]
  createdSubAgentNotes?: Record<string, unknown>[]
  createdCommandNotes?: Record<string, unknown>[]
  createdConnections?: Connection[]
}

export interface BroadcastWorkflowClearResultPayload {
  canvasId: string
  clearedPodIds?: string[]
}
