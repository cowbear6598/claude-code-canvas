import type { Component } from 'vue'

// 訊息角色
export type MessageRole = 'user' | 'assistant'

// 聊天訊息
export interface Message {
  id: string
  role: MessageRole
  content: string
}

// 工具配置
export interface Tool {
  icon: Component
  label: string
  color: string
}
