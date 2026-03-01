import type { Component } from 'vue'

export type ModelType = 'opus' | 'sonnet' | 'haiku'

export type PodStatus = 'idle' | 'chatting' | 'summarizing' | 'error'

export type FrequencyType = 'every-second' | 'every-x-minute' | 'every-x-hour' | 'every-day' | 'every-week'

export interface Schedule {
  frequency: FrequencyType
  second: number
  intervalMinute: number
  intervalHour: number
  hour: number
  minute: number
  weekdays: number[]
  enabled: boolean
  lastTriggeredAt: string | null
}

export interface Pod {
  id: string
  name: string
  x: number
  y: number
  /** 僅存在於前端狀態，由 chatMessageActions 動態建構，後端不持久化此欄位 */
  output: string[]
  rotation: number
  status?: PodStatus
  workspacePath?: string
  outputStyleId?: string | null
  skillIds?: string[]
  subAgentIds?: string[]
  mcpServerIds?: string[]
  model?: ModelType
  repositoryId?: string | null
  autoClear?: boolean
  commandId?: string | null
  schedule?: Schedule | null
}

export interface PodTypeConfig {
  icon: Component
}

export interface Position {
  x: number
  y: number
}

export interface TypeMenuState {
  visible: boolean
  position: Position | null
}
