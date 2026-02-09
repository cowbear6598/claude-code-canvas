import type { Connection, TriggerMode } from '../../types/index.js';

// decide 方法的輸入
export interface TriggerDecideContext {
  canvasId: string;
  sourcePodId: string;
  connections: Connection[];
}

// decide 方法的輸出
export interface TriggerDecideResult {
  connectionId: string;
  approved: boolean;
  reason: string | null;
}

// collectSources 階段的輸入
export interface CollectSourcesContext {
  canvasId: string;
  sourcePodId: string;
  connection: Connection;
  summary: string;
}

// collectSources 階段的輸出
export interface CollectSourcesResult {
  ready: boolean;
  mergedContent?: string;
  isSummarized?: boolean;
}

// TriggerStrategy 介面 — 各觸發模式需要實作
export interface TriggerStrategy {
  mode: TriggerMode;
  decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]>;
  collectSources?(context: CollectSourcesContext): Promise<CollectSourcesResult>;
}

// Pipeline 各階段的共用上下文
export interface PipelineContext {
  canvasId: string;
  sourcePodId: string;
  connection: Connection;
  triggerMode: TriggerMode;
  decideResult: TriggerDecideResult;
}

// ========== 依賴介面（避免循環依賴） ==========

// ExecutionService 方法介面
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

// StateService 方法介面
export interface StateServiceMethods {
  checkMultiInputScenario(canvasId: string, targetPodId: string): {
    isMultiInput: boolean;
    requiredSourcePodIds: string[];
  };
}

// MultiInputService 方法介面
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

// QueueService 方法介面
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

// Pipeline 方法介面
export interface PipelineMethods {
  execute(context: PipelineContext, strategy: any): Promise<void>;
}

// AiDecide 方法介面
export interface AiDecideMethods {
  processAiDecideConnections(canvasId: string, sourcePodId: string, connections: Connection[]): Promise<void>;
}

// AutoTrigger 方法介面
export interface AutoTriggerMethods {
  processAutoTriggerConnection(canvasId: string, sourcePodId: string, connection: Connection): Promise<void>;
}

// DirectTrigger 方法介面
export interface DirectTriggerMethods {
  readonly mode: 'direct';
}
