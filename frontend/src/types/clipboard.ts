import type { PodColor, PodTypeName, ModelType } from './pod'
import type { AnchorPosition } from './connection'

export interface CopiedPod {
  id: string
  name: string
  type: PodTypeName
  color: PodColor
  x: number
  y: number
  rotation: number
  outputStyleId?: string | null
  skillIds?: string[]
  model?: ModelType
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

export interface CopiedConnection {
  sourcePodId: string      // 原始 source POD ID
  sourceAnchor: AnchorPosition
  targetPodId: string      // 原始 target POD ID
  targetAnchor: AnchorPosition
  autoTrigger?: boolean
}
