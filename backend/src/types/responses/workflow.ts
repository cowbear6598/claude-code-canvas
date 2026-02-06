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
