export interface WorkflowAutoTriggeredPayload {
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  transferredContent: string;
  isSummarized: boolean;
}

export interface WorkflowPendingPayload {
  targetPodId: string;
  completedSourcePodIds: string[];
  pendingSourcePodIds: string[];
  totalSources: number;
  completedCount: number;
}

export interface WorkflowSourcesMergedPayload {
  targetPodId: string;
  sourcePodIds: string[];
  mergedContentPreview: string;
}

export interface WorkflowGetDownstreamPodsPayload {
  requestId: string;
  canvasId: string;
  sourcePodId: string;
}

export interface WorkflowGetDownstreamPodsResultPayload {
  requestId: string;
  success: boolean;
  pods?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface WorkflowClearPayload {
  requestId: string;
  canvasId: string;
  sourcePodId: string;
}

export interface WorkflowClearResultPayload {
  requestId: string;
  success: boolean;
  clearedPodIds?: string[];
  clearedPodNames?: string[];
  error?: string;
}
