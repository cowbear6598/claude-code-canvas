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

export interface TriggerStrategy {
  mode: TriggerMode;
  decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]>;
  collectSources?(context: CollectSourcesContext): Promise<CollectSourcesResult>;
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

  triggerWorkflowInternal(canvasId: string, connectionId: string): Promise<void>;

  triggerWorkflowWithSummary(
    canvasId: string,
    connectionId: string,
    summary: string,
    isSummarized: boolean,
    skipAutoTriggeredEvent?: boolean
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
  execute(context: PipelineContext, strategy: any): Promise<void>;
}

export interface AiDecideMethods {
  processAiDecideConnections(canvasId: string, sourcePodId: string, connections: Connection[]): Promise<void>;
}

export interface AutoTriggerMethods {
  processAutoTriggerConnection(canvasId: string, sourcePodId: string, connection: Connection): Promise<void>;
}

export interface DirectTriggerMethods {
  readonly mode: 'direct';
}
