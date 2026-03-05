import type { ModelType } from './pod'

export interface GlobalConfig {
  summaryModel: ModelType
  aiDecideModel: ModelType
}

export const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
]
