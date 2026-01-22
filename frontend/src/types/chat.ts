import type { Component } from 'vue'

// 訊息角色
export type MessageRole = 'user' | 'assistant'

// 工具使用資訊
export interface ToolUseInfo {
  toolName: string
  input: Record<string, unknown>
  output?: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

// 聊天訊息
export interface Message {
  id: string
  role: MessageRole
  content: string
  isPartial?: boolean // For streaming messages
  toolUse?: ToolUseInfo[] // For tool usage display
}

// 工具配置
export interface Tool {
  icon: Component
  label: string
  color: string
}
