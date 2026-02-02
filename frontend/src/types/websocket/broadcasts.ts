import type {Pod} from '@/types'
import type {Connection} from '@/types/connection'
import type {Trigger} from '@/types/trigger'
import type {OutputStyleNote} from '@/types/outputStyle'
import type {SkillNote} from '@/types/skill'
import type {RepositoryNote, Repository} from '@/types/repository'
import type {SubAgentNote} from '@/types/subAgent'
import type {CommandNote} from '@/types/command'

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
  note: OutputStyleNote
}

export interface BroadcastNoteUpdatedPayload {
  canvasId: string
  note: OutputStyleNote
}

export interface BroadcastNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastSkillNoteCreatedPayload {
  canvasId: string
  note: SkillNote
}

export interface BroadcastSkillNoteUpdatedPayload {
  canvasId: string
  note: SkillNote
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
  note: RepositoryNote
}

export interface BroadcastRepositoryNoteUpdatedPayload {
  canvasId: string
  note: RepositoryNote
}

export interface BroadcastRepositoryNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastRepositoryCreatedPayload {
  canvasId: string
  repository: Repository
}

export interface BroadcastRepositoryDeletedPayload {
  canvasId: string
  repositoryId: string
  deletedNoteIds?: string[]
}

export interface BroadcastSubAgentNoteCreatedPayload {
  canvasId: string
  note: SubAgentNote
}

export interface BroadcastSubAgentNoteUpdatedPayload {
  canvasId: string
  note: SubAgentNote
}

export interface BroadcastSubAgentNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastSubAgentCreatedPayload {
  canvasId: string
  subAgent: {
    id: string
    name: string
  }
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
  note: CommandNote
}

export interface BroadcastCommandNoteUpdatedPayload {
  canvasId: string
  note: CommandNote
}

export interface BroadcastCommandNoteDeletedPayload {
  canvasId: string
  noteId: string
}

export interface BroadcastCommandCreatedPayload {
  canvasId: string
  command: {
    id: string
    name: string
  }
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
  createdOutputStyleNotes?: OutputStyleNote[]
  createdSkillNotes?: SkillNote[]
  createdRepositoryNotes?: RepositoryNote[]
  createdSubAgentNotes?: SubAgentNote[]
  createdCommandNotes?: CommandNote[]
  createdConnections?: Connection[]
}

export interface BroadcastWorkflowClearResultPayload {
  canvasId: string
  clearedPodIds?: string[]
}

export interface BroadcastPodChatUserMessagePayload {
  podId: string
  messageId: string
  content: string
  timestamp: string
}
