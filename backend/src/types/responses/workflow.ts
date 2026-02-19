export interface WorkflowAutoTriggeredPayload {
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  transferredContent: string;
  isSummarized: boolean;
}

export interface WorkflowPendingPayload {
  canvasId: string;
  targetPodId: string;
  completedSourcePodIds: string[];
  pendingSourcePodIds: string[];
  totalSources: number;
  completedCount: number;
  rejectedSourcePodIds?: string[];
  hasRejectedSources?: boolean;
}

export interface WorkflowSourcesMergedPayload {
  canvasId: string;
  targetPodId: string;
  sourcePodIds: string[];
  mergedContentPreview: string;
}

export interface WorkflowGetDownstreamPodsResultPayload {
  requestId: string;
  success: boolean;
  pods?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface WorkflowClearResultPayload {
  requestId: string;
  canvasId: string;
  success: boolean;
  clearedPodIds?: string[];
  clearedPodNames?: string[];
  error?: string;
}

export interface WorkflowAiDecidePendingPayload {
  canvasId: string;
  connectionIds: string[];
  sourcePodId: string;
}

export interface WorkflowAiDecideResultPayload {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  shouldTrigger: boolean;
  reason: string;
}

export interface WorkflowAiDecideErrorPayload {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  error: string;
}

export interface WorkflowAiDecideClearPayload {
  canvasId: string;
  connectionIds: string[];
}

export interface WorkflowAiDecideTriggeredPayload {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
}

export interface WorkflowDirectTriggeredPayload {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  transferredContent: string;
  isSummarized: boolean;
}

export interface WorkflowDirectWaitingPayload {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
}

export interface WorkflowQueuedPayload {
  canvasId: string;
  targetPodId: string;
  connectionId: string;
  sourcePodId: string;
  position: number;
  queueSize: number;
  triggerMode: 'auto' | 'ai-decide' | 'direct';
}

export interface WorkflowQueueProcessedPayload {
  canvasId: string;
  targetPodId: string;
  connectionId: string;
  sourcePodId: string;
  remainingQueueSize: number;
  triggerMode: 'auto' | 'ai-decide' | 'direct';
}

export interface WorkflowDirectMergedPayload {
  canvasId: string;
  targetPodId: string;
  sourcePodIds: string[];
  mergedContentPreview: string;
  countdownSeconds: number;
}
