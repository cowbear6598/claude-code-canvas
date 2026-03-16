import type { RunContext } from '../../types/run.js';
import type { SettlementPathway } from './types.js';
import { podStore } from '../podStore.js';
import { runExecutionService } from './runExecutionService.js';
import { fireAndForget } from '../../utils/operationHelpers.js';
import { logger } from '../../utils/logger.js';

export interface WorkflowStatusDelegate {
  startPodExecution(canvasId: string, podId: string): void;
  markSummarizing(canvasId: string, podId: string): void;
  markDeciding(canvasId: string, podId: string): void;
  markWaiting(canvasId: string, podId: string): void;
  onSummaryComplete(canvasId: string, podId: string, pathway?: SettlementPathway): void;
  onSummaryFailed(canvasId: string, podId: string, errorMessage: string): void;
  onChatComplete(canvasId: string, podId: string, pathway: SettlementPathway): void;
  onChatError(canvasId: string, podId: string, errorMessage: string): void;
  shouldEnqueue(): boolean;
  scheduleNextInQueue(canvasId: string, targetPodId: string): void;
  isRunMode(): boolean;
  settleAndSkipPath(canvasId: string, podId: string, pathway: SettlementPathway): void;
}

class NormalModeDelegate implements WorkflowStatusDelegate {
  startPodExecution(canvasId: string, podId: string): void {
    podStore.setStatus(canvasId, podId, 'chatting');
  }

  markSummarizing(canvasId: string, podId: string): void {
    podStore.setStatus(canvasId, podId, 'summarizing');
  }

  markDeciding(_canvasId: string, _podId: string): void {}

  markWaiting(_canvasId: string, _podId: string): void {}

  onSummaryComplete(canvasId: string, podId: string, _pathway?: SettlementPathway): void {
    podStore.setStatus(canvasId, podId, 'idle');
  }

  onSummaryFailed(canvasId: string, podId: string, _errorMessage: string): void {
    podStore.setStatus(canvasId, podId, 'idle');
  }

  onChatComplete(_canvasId: string, _podId: string, _pathway: SettlementPathway): void {}

  onChatError(canvasId: string, podId: string, _errorMessage: string): void {
    podStore.setStatus(canvasId, podId, 'idle');
  }

  shouldEnqueue(): boolean {
    return true;
  }

  scheduleNextInQueue(canvasId: string, targetPodId: string): void {
    // 延遲 import 避免循環依賴，workflowQueueService 間接依賴 workflowExecutionService
    import('./workflowQueueService.js').then(({ workflowQueueService }) => {
      // 刻意不 await：佇列處理獨立於當前 workflow，避免阻塞完成/錯誤回調
      fireAndForget(
        workflowQueueService.processNextInQueue(canvasId, targetPodId),
        'Workflow',
        '處理佇列下一項時發生錯誤'
      );
    }).catch((error) => { logger.error('Workflow', 'Error', '[WorkflowStatusDelegate] 載入 workflowQueueService 失敗', error); });
  }

  isRunMode(): boolean {
    return false;
  }

  settleAndSkipPath(_canvasId: string, _podId: string, _pathway: SettlementPathway): void {}
}

class RunModeDelegate implements WorkflowStatusDelegate {
  constructor(private readonly runContext: RunContext) {}

  startPodExecution(_canvasId: string, podId: string): void {
    runExecutionService.startPodInstance(this.runContext, podId);
  }

  markSummarizing(_canvasId: string, podId: string): void {
    runExecutionService.summarizingPodInstance(this.runContext, podId);
  }

  markDeciding(_canvasId: string, podId: string): void {
    runExecutionService.decidingPodInstance(this.runContext, podId);
  }

  markWaiting(_canvasId: string, podId: string): void {
    runExecutionService.waitingPodInstance(this.runContext, podId);
  }

  onSummaryComplete(_canvasId: string, podId: string, pathway?: SettlementPathway): void {
    if (pathway) {
      runExecutionService.settlePodTrigger(this.runContext, podId, pathway);
    }
  }

  onSummaryFailed(_canvasId: string, podId: string, errorMessage: string): void {
    runExecutionService.errorPodInstance(this.runContext, podId, errorMessage);
  }

  onChatComplete(_canvasId: string, podId: string, pathway: SettlementPathway): void {
    runExecutionService.settlePodTrigger(this.runContext, podId, pathway);
  }

  onChatError(_canvasId: string, podId: string, errorMessage: string): void {
    runExecutionService.errorPodInstance(this.runContext, podId, errorMessage);
  }

  shouldEnqueue(): boolean {
    return false;
  }

  scheduleNextInQueue(_canvasId: string, _targetPodId: string): void {}

  isRunMode(): boolean {
    return true;
  }

  settleAndSkipPath(_canvasId: string, podId: string, pathway: SettlementPathway): void {
    runExecutionService.settleAndSkipPath(this.runContext, podId, pathway);
  }
}

export function createStatusDelegate(runContext?: RunContext): WorkflowStatusDelegate {
  return runContext ? new RunModeDelegate(runContext) : new NormalModeDelegate();
}
