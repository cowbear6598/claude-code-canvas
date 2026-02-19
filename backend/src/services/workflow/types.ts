import type { Connection, TriggerMode } from '../../types/index.js';

export interface TriggerDecideContext {
  canvasId: string;
  sourcePodId: string;
  connections: Connection[];
}

export interface TriggerDecideResult {
  connectionId: string;
  approved: boolean;
  reason: string | null;
  isError: boolean;
}

export interface CollectSourcesContext {
  canvasId: string;
  sourcePodId: string;
  connection: Connection;
  summary: string;
}

export interface CollectSourcesResult {
  ready: boolean;
  mergedContent?: string;
  isSummarized?: boolean;
}

export interface TriggerLifecycleContext {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  summary: string;
  isSummarized: boolean;
}

export interface QueuedContext {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  position: number;
  queueSize: number;
  triggerMode: TriggerMode;
}

export interface QueueProcessedContext {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  remainingQueueSize: number;
  triggerMode: TriggerMode;
}

export interface CompletionContext {
  canvasId: string;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  triggerMode: TriggerMode;
}

export interface TriggerStrategy {
  mode: TriggerMode;

  // 決策階段
  decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]>;

  // 來源收集階段（可選，Direct 模式用到）
  collectSources?(context: CollectSourcesContext): Promise<CollectSourcesResult>;

  // 觸發生命週期
  onTrigger(context: TriggerLifecycleContext): void;
  onComplete(context: CompletionContext, success: boolean, error?: string): void;
  onError(context: CompletionContext, errorMessage: string): void;

  // 佇列生命週期
  onQueued(context: QueuedContext): void;
  onQueueProcessed(context: QueueProcessedContext): void;
}

export interface PipelineContext {
  canvasId: string;
  sourcePodId: string;
  connection: Connection;
  triggerMode: TriggerMode;
  decideResult: TriggerDecideResult;
}

export interface ExecutionServiceMethods {
  generateSummaryWithFallback(
    canvasId: string,
    sourcePodId: string,
    targetPodId: string
  ): Promise<{ content: string; isSummarized: boolean } | null>;

  triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    strategy: TriggerStrategy
  ): Promise<void>;
}

export interface StateServiceMethods {
  checkMultiInputScenario(canvasId: string, targetPodId: string): {
    isMultiInput: boolean;
    requiredSourcePodIds: string[];
  };
}

export interface MultiInputServiceMethods {
  handleMultiInputForConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    requiredSourcePodIds: string[],
    summary: string,
    triggerMode: 'auto' | 'ai-decide'
  ): Promise<void>;
}

export interface QueueServiceMethods {
  enqueue(item: {
    canvasId: string;
    connectionId: string;
    sourcePodId: string;
    targetPodId: string;
    summary: string;
    isSummarized: boolean;
    triggerMode: TriggerMode;
  }): { position: number; queueSize: number };
}

export interface PipelineMethods {
  execute(context: PipelineContext, strategy: TriggerStrategy): Promise<void>;
}

export interface AiDecideMethods {
  processAiDecideConnections(canvasId: string, sourcePodId: string, connections: Connection[]): Promise<void>;
}

export interface AutoTriggerMethods {
  processAutoTriggerConnection(canvasId: string, sourcePodId: string, connection: Connection): Promise<void>;
}
