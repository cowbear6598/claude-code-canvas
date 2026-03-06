export type MessageRole = 'user' | 'assistant'

export type HistoryLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type ToolUseStatus = 'pending' | 'running' | 'completed' | 'error'

const VALID_TOOL_USE_STATUSES: ToolUseStatus[] = ['pending', 'running', 'completed', 'error']

export function isValidToolUseStatus(value: unknown): value is ToolUseStatus {
  return typeof value === 'string' && (VALID_TOOL_USE_STATUSES as string[]).includes(value)
}

export interface ToolUseInfo {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  output?: string | Record<string, unknown> | unknown[]
  status: ToolUseStatus
}

export interface SubMessage {
  id: string
  content: string
  isPartial?: boolean
  toolUse?: ToolUseInfo[]
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
  subMessages?: SubMessage[]
}

