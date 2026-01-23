import type { Component } from 'vue'

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant'

/**
 * History loading status types
 */
export type HistoryLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

/**
 * Tool use status types
 */
export type ToolUseStatus = 'pending' | 'running' | 'completed' | 'error'

/**
 * Tool use information
 */
export interface ToolUseInfo {
  toolName: string
  input: Record<string, unknown>
  output?: string
  status: ToolUseStatus
}

/**
 * Chat message
 */
export interface Message {
  id: string
  role: MessageRole
  content: string
  isPartial?: boolean
  toolUse?: ToolUseInfo[]
  timestamp?: string
}

/**
 * Tool configuration for display
 */
export interface Tool {
  icon: Component
  label: string
  color: string
}
