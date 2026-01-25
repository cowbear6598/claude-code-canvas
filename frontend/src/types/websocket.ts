// WebSocket Event Type Definitions
// Defines all WebSocket events and their payload types

import type { Pod, PodColor, PodTypeName, ModelType, PodStatus } from './pod'
import type { OutputStyleListItem, OutputStyleNote } from './outputStyle'
import type { Skill, SkillNote } from './skill'

// ============================================================================
// Event Name Enums
// ============================================================================

/**
 * Client -> Server Events (Request Events)
 */
export const WebSocketRequestEvents = {
  POD_CREATE: 'pod:create',
  POD_LIST: 'pod:list',
  POD_GET: 'pod:get',
  POD_UPDATE: 'pod:update',
  POD_DELETE: 'pod:delete',
  POD_GIT_CLONE: 'pod:git:clone',
  POD_CHAT_SEND: 'pod:chat:send',
  POD_CHAT_HISTORY: 'pod:chat:history',
  POD_JOIN: 'pod:join',
  POD_JOIN_BATCH: 'pod:join:batch',
  POD_LEAVE: 'pod:leave',
  OUTPUT_STYLE_LIST: 'output-style:list',
  POD_BIND_OUTPUT_STYLE: 'pod:bind-output-style',
  POD_UNBIND_OUTPUT_STYLE: 'pod:unbind-output-style',
  NOTE_CREATE: 'note:create',
  NOTE_LIST: 'note:list',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  SKILL_LIST: 'skill:list',
  SKILL_NOTE_CREATE: 'skill-note:create',
  SKILL_NOTE_LIST: 'skill-note:list',
  SKILL_NOTE_UPDATE: 'skill-note:update',
  SKILL_NOTE_DELETE: 'skill-note:delete',
  POD_BIND_SKILL: 'pod:bind-skill',
  CONNECTION_CREATE: 'connection:create',
  CONNECTION_LIST: 'connection:list',
  CONNECTION_DELETE: 'connection:delete',
  CONNECTION_UPDATE: 'connection:update',
  WORKFLOW_GET_DOWNSTREAM_PODS: 'workflow:get-downstream-pods',
  WORKFLOW_CLEAR: 'workflow:clear',
} as const

export type WebSocketRequestEvents = typeof WebSocketRequestEvents[keyof typeof WebSocketRequestEvents]

/**
 * Server -> Client Events (Response Events)
 */
export const WebSocketResponseEvents = {
  CONNECTION_READY: 'connection:ready',
  POD_CREATED: 'pod:created',
  POD_LIST_RESULT: 'pod:list:result',
  POD_GET_RESULT: 'pod:get:result',
  POD_UPDATED: 'pod:updated',
  POD_DELETED: 'pod:deleted',
  POD_GIT_CLONE_PROGRESS: 'pod:git:clone:progress',
  POD_GIT_CLONE_RESULT: 'pod:git:clone:result',
  POD_CHAT_MESSAGE: 'pod:chat:message',
  POD_CHAT_TOOL_USE: 'pod:chat:tool_use',
  POD_CHAT_TOOL_RESULT: 'pod:chat:tool_result',
  POD_CHAT_COMPLETE: 'pod:chat:complete',
  POD_CHAT_HISTORY_RESULT: 'pod:chat:history:result',
  POD_JOINED: 'pod:joined',
  POD_JOINED_BATCH: 'pod:joined:batch',
  POD_LEFT: 'pod:left',
  POD_ERROR: 'pod:error',
  POD_STATUS_CHANGED: 'pod:status:changed',
  OUTPUT_STYLE_LIST_RESULT: 'output-style:list:result',
  POD_OUTPUT_STYLE_BOUND: 'pod:output-style:bound',
  POD_OUTPUT_STYLE_UNBOUND: 'pod:output-style:unbound',
  NOTE_CREATED: 'note:created',
  NOTE_LIST_RESULT: 'note:list:result',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  SKILL_LIST_RESULT: 'skill:list:result',
  SKILL_NOTE_CREATED: 'skill-note:created',
  SKILL_NOTE_LIST_RESULT: 'skill-note:list:result',
  SKILL_NOTE_UPDATED: 'skill-note:updated',
  SKILL_NOTE_DELETED: 'skill-note:deleted',
  POD_SKILL_BOUND: 'pod:skill:bound',
  CONNECTION_CREATED: 'connection:created',
  CONNECTION_LIST_RESULT: 'connection:list:result',
  CONNECTION_DELETED: 'connection:deleted',
  CONNECTION_UPDATED: 'connection:updated',
  WORKFLOW_TRIGGERED: 'workflow:triggered',
  WORKFLOW_COMPLETE: 'workflow:complete',
  WORKFLOW_ERROR: 'workflow:error',
  WORKFLOW_AUTO_TRIGGERED: 'workflow:auto-triggered',
  WORKFLOW_PENDING: 'workflow:pending',
  WORKFLOW_SOURCES_MERGED: 'workflow:sources-merged',
  WORKFLOW_GET_DOWNSTREAM_PODS_RESULT: 'workflow:get-downstream-pods:result',
  WORKFLOW_CLEAR_RESULT: 'workflow:clear:result',
} as const

export type WebSocketResponseEvents = typeof WebSocketResponseEvents[keyof typeof WebSocketResponseEvents]

// ============================================================================
// Request Payload Types (Client -> Server)
// ============================================================================

export interface PodCreatePayload {
  requestId: string
  name: string
  type: PodTypeName
  color: PodColor
  // Canvas-specific fields
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
  // Optional fields to update
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

// ============================================================================
// Response Payload Types (Server -> Client)
// ============================================================================

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

export interface PodGetResultPayload {
  requestId: string
  success: boolean
  pod?: Pod
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

export interface PodGitCloneProgressPayload {
  podId: string
  progress: number
  message: string
}

export interface PodGitCloneResultPayload {
  requestId: string
  success: boolean
  pod?: Pod
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

export interface PodJoinedPayload {
  podId: string
}

export interface PodLeftPayload {
  podId: string
}

export interface PodJoinedBatchPayload {
  joinedPodIds: string[]
  failedPodIds: string[]
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

// ============================================================================
// Skill Request Payload Types
// ============================================================================

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

// ============================================================================
// Skill Response Payload Types
// ============================================================================

export interface SkillListResultPayload {
  requestId: string
  success: boolean
  skills?: Skill[]
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

export interface WorkflowTriggeredPayload {
  requestId: string
  success: boolean
  connectionId: string
  sourcePodId: string
  targetPodId: string
  transferredContent: string
  isSummarized?: boolean
  error?: string
}

export interface ConnectionUpdatedPayload {
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

export interface WorkflowErrorPayload {
  requestId: string
  connectionId: string
  error: string
  code: string
}

export interface WorkflowPendingPayload {
  targetPodId: string
  completedSourcePodIds: string[]
  pendingSourcePodIds: string[]
  totalSources: number
  completedCount: number
}

export interface WorkflowSourcesMergedPayload {
  targetPodId: string
  sourcePodIds: string[]
  mergedContentPreview: string
}

export interface WorkflowGetDownstreamPodsPayload {
  requestId: string
  sourcePodId: string
}

export interface WorkflowGetDownstreamPodsResultPayload {
  requestId: string
  success: boolean
  pods?: Array<{ id: string; name: string }>
  error?: string
}

export interface WorkflowClearPayload {
  requestId: string
  sourcePodId: string
}

export interface WorkflowClearResultPayload {
  requestId: string
  success: boolean
  clearedPodIds?: string[]
  clearedPodNames?: string[]
  error?: string
}
