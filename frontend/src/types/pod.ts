import type { Component } from 'vue'

// Pod 顏色類型
export type PodColor = 'blue' | 'coral' | 'pink' | 'yellow' | 'green'

// Pod Model 類型
export type ModelType = 'opus' | 'sonnet' | 'haiku'

// Pod 狀態類型
export type PodStatus = 'idle' | 'chatting' | 'summarizing' | 'error'

// Pod 實體
export interface Pod {
  id: string
  name: string
  x: number
  y: number
  color: PodColor
  output: string[]
  rotation: number
  status?: PodStatus
  gitUrl?: string
  workspacePath?: string
  createdAt?: string
  updatedAt?: string
  outputStyleId?: string | null
  skillIds?: string[]
  subAgentIds?: string[]
  model?: ModelType
  repositoryId?: string | null
  autoClear?: boolean
  commandId?: string | null
}

// Pod 類型配置
export interface PodTypeConfig {
  icon: Component
  color: PodColor
}

// Position 類型
export interface Position {
  x: number
  y: number
}

// TypeMenu 狀態類型
export interface TypeMenuState {
  visible: boolean
  position: Position | null
}
