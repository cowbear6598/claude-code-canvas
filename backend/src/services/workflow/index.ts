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
export { runQueueService } from './runQueueService.js';
export { workflowPipeline } from './workflowPipeline.js';
export { runExecutionService } from './runExecutionService.js';
export type * from './types.js';

import { workflowPipeline } from './workflowPipeline.js';
import { workflowAutoTriggerService } from './workflowAutoTriggerService.js';
import { workflowAiDecideTriggerService } from './workflowAiDecideTriggerService.js';
import { workflowDirectTriggerService } from './workflowDirectTriggerService.js';
import { workflowMultiInputService } from './workflowMultiInputService.js';
import { workflowExecutionService } from './workflowExecutionService.js';
import { workflowQueueService } from './workflowQueueService.js';
import { runQueueService } from './runQueueService.js';
import { runExecutionService } from './runExecutionService.js';
import { workflowStateService } from './workflowStateService.js';
import { workflowEventEmitter } from './workflowEventEmitter.js';
import { aiDecideService } from './aiDecideService.js';
import { connectionStore } from '../connectionStore.js';
import { podStore } from '../podStore.js';
import { pendingTargetStore } from '../pendingTargetStore.js';
export function initWorkflowServices(): void {
  const sharedStrategies = {
    auto: workflowAutoTriggerService,
    direct: workflowDirectTriggerService,
    'ai-decide': workflowAiDecideTriggerService,
  };

  workflowPipeline.init({
    executionService: workflowExecutionService,
    multiInputService: workflowMultiInputService,
    queueService: workflowQueueService,
  });

  workflowAutoTriggerService.init({ pipeline: workflowPipeline });

  workflowAiDecideTriggerService.init({
    aiDecideService,
    eventEmitter: workflowEventEmitter,
    connectionStore,
    podStore,
    stateService: workflowStateService,
    pendingTargetStore,
    pipeline: workflowPipeline,
    multiInputService: workflowMultiInputService,
  });

  workflowMultiInputService.init({
    executionService: workflowExecutionService,
    strategies: sharedStrategies,
  });

  workflowQueueService.init({
    executionService: workflowExecutionService,
    strategies: sharedStrategies,
  });

  runQueueService.init({
    executionService: workflowExecutionService,
    strategies: sharedStrategies,
    queuedPodInstance: (ctx, podId) => runExecutionService.queuedPodInstance(ctx, podId),
  });

  workflowExecutionService.init({
    pipeline: workflowPipeline,
    aiDecideTriggerService: workflowAiDecideTriggerService,
    autoTriggerService: workflowAutoTriggerService,
    directTriggerService: workflowDirectTriggerService,
  });
}

initWorkflowServices();
