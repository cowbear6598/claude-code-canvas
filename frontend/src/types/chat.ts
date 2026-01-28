import type { Component } from 'vue'

export type MessageRole = 'user' | 'assistant'

export type HistoryLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type ToolUseStatus = 'pending' | 'running' | 'completed' | 'error'

export interface ToolUseInfo {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  output?: string
  status: ToolUseStatus
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  isPartial?: boolean
  toolUse?: ToolUseInfo[]
  timestamp?: string
  isSummarized?: boolean
  sourceInfo?: { podId: string; podName: string }
}

export interface Tool {
  icon: Component
  label: string
  color: string
}
