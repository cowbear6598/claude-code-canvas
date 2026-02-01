import type { PodColor, ModelType } from '../pod'

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface PodCreatePayload {
  requestId: string
  name: string
  color: PodColor
  x: number
  y: number
  rotation: number
}

export interface PodListPayload {
  requestId: string
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

export interface TextContentBlock {
  type: 'text'
  text: string
}

export interface ImageContentBlock {
  type: 'image'
  mediaType: ImageMediaType
  base64Data: string
}

export type ContentBlock = TextContentBlock | ImageContentBlock

export interface PodChatSendPayload {
  requestId: string
  podId: string
  message: string | ContentBlock[]
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

export interface NoteCreatePayload {
  requestId: string
  outputStyleId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface ConnectionCreatePayload {
  requestId: string
  sourcePodId?: string
  sourceAnchor: 'top' | 'bottom' | 'left' | 'right'
  targetPodId: string
  targetAnchor: 'top' | 'bottom' | 'left' | 'right'
  sourceType?: 'pod' | 'trigger'
  sourceTriggerId?: string
}

export interface ConnectionListPayload {
  requestId: string
}

export interface ConnectionDeletePayload {
  requestId: string
  connectionId: string
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
  color: PodColor
  x: number
  y: number
  rotation: number
  outputStyleId?: string | null
  skillIds?: string[]
  subAgentIds?: string[]
  model?: ModelType
  repositoryId?: string | null
  commandId?: string | null
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
  subAgentNotes: PasteSubAgentNoteItem[]
  commandNotes: PasteCommandNoteItem[]
  connections: PasteConnectionItem[]
}

export interface RepositoryCreatePayload {
  requestId: string
  name: string
}

export interface RepositoryGitClonePayload {
  requestId: string
  repoUrl: string
  branch?: string
}

export interface PodSetAutoClearPayload {
  requestId: string
  podId: string
  autoClear: boolean
}

export interface PasteSubAgentNoteItem {
  subAgentId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CommandNoteCreatePayload {
  requestId: string
  commandId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface PasteCommandNoteItem {
  commandId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface TriggerCreatePayload {
  requestId: string
  name: string
  type: 'time'
  config: {
    frequency: 'every-second' | 'every-x-minute' | 'every-x-hour' | 'every-day' | 'every-week'
    second: number
    intervalMinute: number
    intervalHour: number
    hour: number
    minute: number
    weekdays: number[]
  }
  x: number
  y: number
  rotation: number
  enabled?: boolean
}

export interface TriggerListPayload {
  requestId: string
}

export interface TriggerUpdatePayload {
  requestId: string
  triggerId: string
  name?: string
  config?: {
    frequency: 'every-second' | 'every-x-minute' | 'every-x-hour' | 'every-day' | 'every-week'
    second: number
    intervalMinute: number
    intervalHour: number
    hour: number
    minute: number
    weekdays: number[]
  }
  x?: number
  y?: number
  rotation?: number
  enabled?: boolean
}

export interface TriggerDeletePayload {
  requestId: string
  triggerId: string
}
