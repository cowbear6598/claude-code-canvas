// Workflow Service - Central Export

export * from './types.js';
export { workflowEventEmitter } from './workflowEventEmitter.js';
export { workflowContentFormatter } from './workflowContentFormatter.js';
export { workflowValidationService } from './workflowValidationService.js';
export { workflowStateService } from './workflowStateService.js';
export { workflowExecutionService } from './workflowExecutionService.js';

import { workflowExecutionService } from './workflowExecutionService.js';
import { workflowStateService } from './workflowStateService.js';

// Facade for workflow functionality
export const workflowService = {
  // Execution
  checkAndTriggerWorkflows: (sourcePodId: string): Promise<void> =>
    workflowExecutionService.checkAndTriggerWorkflows(sourcePodId),
  triggerWorkflowInternal: (connectionId: string): Promise<void> =>
    workflowExecutionService.triggerWorkflowInternal(connectionId),
  triggerWorkflowWithSummary: (connectionId: string, summary: string, isSummarized: boolean): Promise<void> =>
    workflowExecutionService.triggerWorkflowWithSummary(connectionId, summary, isSummarized),

  // State management
  handleSourceDeletion: (sourcePodId: string): string[] =>
    workflowStateService.handleSourceDeletion(sourcePodId),
  handleConnectionDeletion: (connectionId: string): void =>
    workflowStateService.handleConnectionDeletion(connectionId),
};
