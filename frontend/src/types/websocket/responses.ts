// WebSocket Response Payload Types (Server -> Client)

import type { Pod, PodStatus } from '../pod'
import type { OutputStyleListItem, OutputStyleNote } from '@/types'
import type { Skill, SkillNote } from '@/types'
import type { Repository, RepositoryNote } from '@/types'
import type { SubAgent, SubAgentNote } from '@/types'

export interface ConnectionReadyPayload {
  socketId: string
}

export interface PodCreatedPayload {
  requestId: string
  success: boolean
  pod?: Pod
  error?: string
}

export interface PodListResultPayload {
  requestId: string
  success: boolean
  pods?: Pod[]
  error?: string
}
export interface PodUpdatedPayload {
  requestId: string
  success: boolean
  pod?: Pod
  error?: string
}

export interface PodDeletedPayload {
  requestId: string
  success: boolean
  podId?: string
  error?: string
}
export interface PodChatMessagePayload {
  podId: string
  messageId: string
  content: string
  isPartial: boolean
  role?: 'user' | 'assistant'
}

export interface PodChatToolUsePayload {
  podId: string
  messageId: string
  toolName: string
  input: Record<string, unknown>
}

export interface PodChatToolResultPayload {
  podId: string
  messageId: string
  toolName: string
  output: string
}

export interface PodChatCompletePayload {
  podId: string
  messageId: string
  fullContent: string
}
export interface PodErrorPayload {
  requestId?: string
  podId?: string
  error: string
  code: string
}

export interface PodStatusChangedPayload {
  podId: string
  status: PodStatus
  previousStatus: PodStatus
}

export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface PodChatHistoryResultPayload {
  requestId: string
  success: boolean
  messages?: PersistedMessage[]
  error?: string
}

export interface OutputStyleListResultPayload {
  requestId: string
  success: boolean
  styles?: OutputStyleListItem[]
  error?: string
}

export interface OutputStyleDeletedPayload {
  requestId: string
  success: boolean
  outputStyleId?: string
  deletedNoteIds?: string[]
  error?: string
}

export interface PodOutputStyleBoundPayload {
  requestId: string
  success: boolean
  podId?: string
  outputStyleId?: string
  error?: string
}

export interface PodOutputStyleUnboundPayload {
  requestId: string
  success: boolean
  podId?: string
  error?: string
}

export interface NoteCreatedPayload {
  requestId: string
  success: boolean
  note?: OutputStyleNote
  error?: string
}

export interface NoteListResultPayload {
  requestId: string
  success: boolean
  notes?: OutputStyleNote[]
  error?: string
}

export interface NoteUpdatedPayload {
  requestId: string
  success: boolean
  note?: OutputStyleNote
  error?: string
}

export interface NoteDeletedPayload {
  requestId: string
  success: boolean
  noteId?: string
  error?: string
}

export interface SkillListResultPayload {
  requestId: string
  success: boolean
  skills?: Skill[]
  error?: string
}

export interface SkillDeletedPayload {
  requestId: string
  success: boolean
  skillId?: string
  deletedNoteIds?: string[]
  error?: string
}

export interface SkillNoteCreatedPayload {
  requestId: string
  success: boolean
  note?: SkillNote
  error?: string
}

export interface SkillNoteListResultPayload {
  requestId: string
  success: boolean
  notes?: SkillNote[]
  error?: string
}

export interface SkillNoteUpdatedPayload {
  requestId: string
  success: boolean
  note?: SkillNote
  error?: string
}

export interface SkillNoteDeletedPayload {
  requestId: string
  success: boolean
  noteId?: string
  error?: string
}

export interface PodSkillBoundPayload {
  requestId: string
  success: boolean
  pod?: Pod
  error?: string
}

export interface ConnectionCreatedPayload {
  requestId: string
  success: boolean
  connection?: {
    id: string
    sourcePodId: string
    sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
    targetPodId: string
    targetAnchor: 'top' | 'bottom' | 'left' | 'right'
    createdAt: string
    autoTrigger?: boolean
  }
  error?: string
}

export interface ConnectionListResultPayload {
  requestId: string
  success: boolean
  connections?: Array<{
    id: string
    sourcePodId: string
    sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
    targetPodId: string
    targetAnchor: 'top' | 'bottom' | 'left' | 'right'
    createdAt: string
    autoTrigger?: boolean
  }>
  error?: string
}

export interface ConnectionDeletedPayload {
  requestId: string
  success: boolean
  connectionId?: string
  error?: string
}
export interface WorkflowAutoTriggeredPayload {
  connectionId: string
  sourcePodId: string
  targetPodId: string
  transferredContent: string
  isSummarized: boolean
}

export interface WorkflowCompletePayload {
  requestId: string
  connectionId: string
  targetPodId: string
  success: boolean
  error?: string
}

export interface WorkflowGetDownstreamPodsResultPayload {
  requestId: string
  success: boolean
  pods?: Array<{ id: string; name: string }>
  error?: string
}

export interface WorkflowClearResultPayload {
  requestId: string
  success: boolean
  clearedPodIds?: string[]
  clearedPodNames?: string[]
  error?: string
}

export interface PasteError {
  type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote'
  originalId: string
  error: string
}

export interface CanvasPasteResultPayload {
  requestId: string
  success: boolean
  createdPods: Pod[]
  createdOutputStyleNotes: OutputStyleNote[]
  createdSkillNotes: SkillNote[]
  createdRepositoryNotes: RepositoryNote[]
  createdSubAgentNotes: SubAgentNote[]
  createdConnections: Array<{
    id: string
    sourcePodId: string
    sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
    targetPodId: string
    targetAnchor: 'top' | 'bottom' | 'left' | 'right'
    createdAt: string
    autoTrigger?: boolean
  }>
  podIdMapping: Record<string, string>
  errors: PasteError[]
  error?: string
}

export interface RepositoryListResultPayload {
  requestId: string
  success: boolean
  repositories?: Repository[]
  error?: string
}

export interface RepositoryCreatedPayload {
  requestId: string
  success: boolean
  repository?: Repository
  error?: string
}

export interface RepositoryDeletedPayload {
  requestId: string
  success: boolean
  repositoryId?: string
  deletedNoteIds?: string[]
  error?: string
}

export interface RepositoryNoteCreatedPayload {
  requestId: string
  success: boolean
  note?: RepositoryNote
  error?: string
}

export interface RepositoryNoteListResultPayload {
  requestId: string
  success: boolean
  notes?: RepositoryNote[]
  error?: string
}

export interface RepositoryNoteUpdatedPayload {
  requestId: string
  success: boolean
  note?: RepositoryNote
  error?: string
}

export interface RepositoryNoteDeletedPayload {
  requestId: string
  success: boolean
  noteId?: string
  error?: string
}

export interface PodRepositoryBoundPayload {
  requestId: string
  success: boolean
  podId?: string
  repositoryId?: string
  error?: string
}

export interface PodRepositoryUnboundPayload {
  requestId: string
  success: boolean
  podId?: string
  error?: string
}

export interface PodMessagesClearedPayload {
  podId: string
}

export interface PodAutoClearSetPayload {
  requestId: string
  success: boolean
  pod?: Pod
  error?: string
}

export interface WorkflowAutoClearedPayload {
  sourcePodId: string
  clearedPodIds: string[]
  clearedPodNames: string[]
}

export interface SubAgentListResultPayload {
  requestId: string
  success: boolean
  subAgents?: SubAgent[]
  error?: string
}

export interface SubAgentDeletedPayload {
  requestId: string
  success: boolean
  subAgentId?: string
  deletedNoteIds?: string[]
  error?: string
}

export interface SubAgentNoteCreatedPayload {
  requestId: string
  success: boolean
  note?: SubAgentNote
  error?: string
}

export interface SubAgentNoteListResultPayload {
  requestId: string
  success: boolean
  notes?: SubAgentNote[]
  error?: string
}

export interface SubAgentNoteUpdatedPayload {
  requestId: string
  success: boolean
  note?: SubAgentNote
  error?: string
}

export interface SubAgentNoteDeletedPayload {
  requestId: string
  success: boolean
  noteId?: string
  error?: string
}

export interface PodSubAgentBoundPayload {
  requestId: string
  success: boolean
  pod?: Pod
  error?: string
}
