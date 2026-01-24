import type { Component } from 'vue'

// Pod 顏色類型
export type PodColor = 'blue' | 'coral' | 'pink' | 'yellow' | 'green'

// Pod 類型名稱
export type PodTypeName =
  | 'Code Assistant'
  | 'Chat Companion'
  | 'Creative Writer'
  | 'Data Analyst'
  | 'General AI'

// Pod 實體
export interface Pod {
  id: string
  name: string
  type: PodTypeName
  x: number
  y: number
  color: PodColor
  output: string[]
  rotation: number
  status?: 'idle' | 'busy' | 'error'
  gitUrl?: string
  workspacePath?: string
  createdAt?: string
  updatedAt?: string
  outputStyleId?: string | null
  skillIds?: string[]
}

// Pod 類型配置
export interface PodTypeConfig {
  type: PodTypeName
  icon: Component
  color: PodColor
}
