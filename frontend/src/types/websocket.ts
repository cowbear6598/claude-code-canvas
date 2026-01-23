// WebSocket Event Type Definitions
// Defines all WebSocket events and their payload types

import type { Pod, PodColor, PodTypeName } from './pod'

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
  POD_LEAVE: 'pod:leave',
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
  POD_LEFT: 'pod:left',
  POD_ERROR: 'pod:error',
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

export interface PodChatHistoryPayload {
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

export interface PodErrorPayload {
  requestId?: string
  podId?: string
  error: string
  code: string
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
