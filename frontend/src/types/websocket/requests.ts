// WebSocket Request Payload Types (Client -> Server)

import type { PodColor, PodTypeName, ModelType } from '../pod'

export interface PodCreatePayload {
  requestId: string
  name: string
  type: PodTypeName
  color: PodColor
  x: number
  y: number
  rotation: number
}

export interface PodListPayload {
  requestId: string
}

export interface PodGetPayload {
  requestId: string
  podId: string
}

export interface PodUpdatePayload {
  requestId: string
  podId: string
  x?: number
  y?: number
  rotation?: number
  name?: string
  model?: ModelType
}

export interface PodDeletePayload {
  requestId: string
  podId: string
}

export interface PodGitClonePayload {
  requestId: string
  podId: string
  repoUrl: string
  branch?: string
}

export interface PodChatSendPayload {
  requestId: string
  podId: string
  message: string
}

export interface PodJoinPayload {
  podId: string
}

export interface PodLeavePayload {
  podId: string
}

export interface PodJoinBatchPayload {
  podIds: string[]
}

export interface PodChatHistoryPayload {
  requestId: string
  podId: string
}

export interface OutputStyleListPayload {
  requestId: string
}

export interface PodBindOutputStylePayload {
  requestId: string
  podId: string
  outputStyleId: string
}

export interface PodUnbindOutputStylePayload {
  requestId: string
  podId: string
}

export interface NoteCreatePayload {
  requestId: string
  outputStyleId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface NoteListPayload {
  requestId: string
}

export interface NoteUpdatePayload {
  requestId: string
  noteId: string
  x?: number
  y?: number
  boundToPodId?: string | null
  originalPosition?: { x: number; y: number } | null
}

export interface NoteDeletePayload {
  requestId: string
  noteId: string
}

export interface SkillListPayload {
  requestId: string
}

export interface SkillNoteCreatePayload {
  requestId: string
  skillId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface SkillNoteListPayload {
  requestId: string
}

export interface SkillNoteUpdatePayload {
  requestId: string
  noteId: string
  x?: number
  y?: number
  boundToPodId?: string | null
  originalPosition?: { x: number; y: number } | null
}

export interface SkillNoteDeletePayload {
  requestId: string
  noteId: string
}

export interface PodBindSkillPayload {
  requestId: string
  podId: string
  skillId: string
}

export interface ConnectionCreatePayload {
  requestId: string
  sourcePodId: string
  sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
  targetPodId: string
  targetAnchor: 'top' | 'bottom' | 'left' | 'right'
}

export interface ConnectionListPayload {
  requestId: string
}

export interface ConnectionDeletePayload {
  requestId: string
  connectionId: string
}

export interface ConnectionUpdatePayload {
  requestId: string
  connectionId: string
  autoTrigger?: boolean
}

export interface WorkflowGetDownstreamPodsPayload {
  requestId: string
  sourcePodId: string
}

export interface WorkflowClearPayload {
  requestId: string
  sourcePodId: string
}

export interface PastePodItem {
  originalId: string
  name: string
  type: PodTypeName
  color: PodColor
  x: number
  y: number
  rotation: number
  outputStyleId?: string | null
  skillIds?: string[]
  model?: ModelType
  repositoryId?: string | null
}

export interface PasteOutputStyleNoteItem {
  outputStyleId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface PasteSkillNoteItem {
  skillId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface PasteRepositoryNoteItem {
  repositoryId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface PasteConnectionItem {
  originalSourcePodId: string
  sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
  originalTargetPodId: string
  targetAnchor: 'top' | 'bottom' | 'left' | 'right'
  autoTrigger?: boolean
}

export interface CanvasPastePayload {
  requestId: string
  pods: PastePodItem[]
  outputStyleNotes: PasteOutputStyleNoteItem[]
  skillNotes: PasteSkillNoteItem[]
  repositoryNotes: PasteRepositoryNoteItem[]
  connections: PasteConnectionItem[]
}

export interface RepositoryListPayload {
  requestId: string
}

export interface RepositoryCreatePayload {
  requestId: string
  name: string
}

export interface RepositoryNoteCreatePayload {
  requestId: string
  repositoryId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface RepositoryNoteListPayload {
  requestId: string
}

export interface RepositoryNoteUpdatePayload {
  requestId: string
  noteId: string
  x?: number
  y?: number
  boundToPodId?: string | null
  originalPosition?: { x: number; y: number } | null
}

export interface RepositoryNoteDeletePayload {
  requestId: string
  noteId: string
}

export interface PodBindRepositoryPayload {
  requestId: string
  podId: string
  repositoryId: string
}

export interface PodUnbindRepositoryPayload {
  requestId: string
  podId: string
}
