export { workflowEventEmitter } from './workflowEventEmitter.js';
export { workflowStateService } from './workflowStateService.js';
export { workflowExecutionService } from './workflowExecutionService.js';
export { workflowAutoTriggerService } from './workflowAutoTriggerService.js';
export { workflowMultiInputService } from './workflowMultiInputService.js';
export { workflowDirectTriggerService } from './workflowDirectTriggerService.js';
export { workflowAiDecideTriggerService } from './workflowAiDecideTriggerService.js';
export { aiDecideService } from './aiDecideService.js';
export { aiDecidePromptBuilder } from './aiDecidePromptBuilder.js';
export { workflowQueueService } from './workflowQueueService.js';
export { workflowPipeline } from './workflowPipeline.js';
export type * from './types.js';

import { workflowPipeline } from './workflowPipeline.js';
import { workflowAutoTriggerService } from './workflowAutoTriggerService.js';
import { workflowAiDecideTriggerService } from './workflowAiDecideTriggerService.js';
import { workflowDirectTriggerService } from './workflowDirectTriggerService.js';
import { workflowMultiInputService } from './workflowMultiInputService.js';
import { workflowExecutionService } from './workflowExecutionService.js';
import { workflowQueueService } from './workflowQueueService.js';
import { workflowStateService } from './workflowStateService.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import { aiDecideService } from './aiDecideService.js';
import { connectionStore } from '../connectionStore.js';
import { pendingTargetStore } from '../pendingTargetStore.js';

/**
 * 初始化 Workflow 相關服務（解決循環依賴）
 */
export function initWorkflowServices(): void {
  // 1. Pipeline
  workflowPipeline.init(
    workflowExecutionService,
    workflowStateService,
    workflowMultiInputService,
    workflowQueueService
  );

  // 2. Auto Strategy
  workflowAutoTriggerService.init({ pipeline: workflowPipeline });

  // 3. AI-Decide Strategy
  workflowAiDecideTriggerService.init(
    aiDecideService,
    workflowEventEmitter,
    connectionStore,
    workflowStateService,
    pendingTargetStore,
    workflowPipeline,
    workflowMultiInputService
  );

  // 4. MultiInput
  workflowMultiInputService.init({ executionService: workflowExecutionService });

  // 5. Queue
  workflowQueueService.init({ executionService: workflowExecutionService });

  // 6. ExecutionService（最後初始化，因為它依賴上面的 services）
  workflowExecutionService.init({
    pipeline: workflowPipeline,
    aiDecideTriggerService: workflowAiDecideTriggerService,
    autoTriggerService: workflowAutoTriggerService,
    directTriggerService: workflowDirectTriggerService,
  });
}

// 立即初始化
initWorkflowServices();
