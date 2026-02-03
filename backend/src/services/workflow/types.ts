import type { Pod } from '../../types/index.js';

export interface WorkflowContext {
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  sourcePod: Pod;
  targetPod: Pod;
}

export interface WorkflowResult {
  success: boolean;
  error?: string;
  transferredContent?: string;
  isSummarized?: boolean;
}

export interface MultiInputState {
  targetPodId: string;
  requiredSourcePodIds: string[];
  completedSources: Map<string, string>;
  isReady: boolean;
}
