import type { ModelType } from './pod'
import type { AnchorPosition, TriggerMode } from './connection'

export interface CopiedPod {
  id: string
  name: string
  x: number
  y: number
  rotation: number
  outputStyleId?: string | null
  skillIds?: string[]
  subAgentIds?: string[]
  model?: ModelType
  repositoryId?: string | null
  commandId?: string | null
}

export interface CopiedOutputStyleNote {
  id: string
  outputStyleId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CopiedSkillNote {
  id: string
  skillId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CopiedRepositoryNote {
  repositoryId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CopiedSubAgentNote {
  id: string
  subAgentId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CopiedCommandNote {
  commandId: string
  name: string
  x: number
  y: number
  boundToOriginalPodId: string | null
  originalPosition: { x: number; y: number } | null
}

export interface CopiedConnection {
  sourcePodId: string
  sourceAnchor: AnchorPosition
  targetPodId: string
  targetAnchor: AnchorPosition
  triggerMode?: TriggerMode
}
