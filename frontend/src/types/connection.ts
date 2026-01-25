export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right'

export type ConnectionStatus = 'inactive' | 'active'

export type WorkflowStatus = 'idle' | 'transferring' | 'processing' | 'completed' | 'error' | 'waiting'

export interface PendingInfo {
  completedCount: number
  totalCount: number
}

export interface Connection {
  id: string
  sourcePodId: string
  sourceAnchor: AnchorPosition
  targetPodId: string
  targetAnchor: AnchorPosition
  createdAt: Date
  status?: ConnectionStatus
  workflowStatus?: WorkflowStatus
  autoTrigger?: boolean
  pendingInfo?: PendingInfo
}

export interface DraggingConnection {
  sourcePodId: string
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
