export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right'

export type TriggerMode = 'auto' | 'ai-decide' | 'direct'

export type WorkflowRole = 'head' | 'tail' | 'middle' | 'independent'

export type ConnectionStatus = 'idle' | 'active' | 'queued' | 'waiting' | 'ai-deciding' | 'ai-approved' | 'ai-rejected' | 'ai-error'

export interface Connection {
  id: string
  sourcePodId?: string
  sourceAnchor: AnchorPosition
  targetPodId: string
  targetAnchor: AnchorPosition
  createdAt: Date
  status?: ConnectionStatus
  triggerMode: TriggerMode
  decideReason?: string
}

export interface DraggingConnection {
  sourcePodId?: string
  sourceAnchor: AnchorPosition
  startPoint: { x: number; y: number }
  currentPoint: { x: number; y: number }
}

export interface AnchorPoint {
  podId: string
  anchor: AnchorPosition
  x: number
  y: number
}
