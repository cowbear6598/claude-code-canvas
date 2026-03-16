import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { workflowEventEmitter } from '../../src/services/workflow/workflowEventEmitter.js';
import { WebSocketResponseEvents } from '../../src/schemas/index.js';
import { setupSocketServiceSpy, setupLoggerSpy } from '../mocks/workflowSpySetup.js';

describe('WorkflowEventEmitter', () => {
  const canvasId = 'canvas-test-1';

  let socketSpy: ReturnType<typeof setupSocketServiceSpy>;

  beforeEach(() => {
    setupLoggerSpy();
    socketSpy = setupSocketServiceSpy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('emitWorkflowAutoTriggered', () => {
    it('應呼叫 emitToCanvas 並自動附加 canvasId', () => {
      const payload = {
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        transferredContent: 'hello',
        isSummarized: false,
      };

      workflowEventEmitter.emitWorkflowAutoTriggered(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED,
        { ...payload, canvasId }
      );
    });
  });

  describe('emitWorkflowPending', () => {
    it('應呼叫 emitToCanvas 並附加 canvasId', () => {
      const payload = {
        canvasId,
        targetPodId: 'target-1',
        completedSourcePodIds: ['source-1'],
        pendingSourcePodIds: [],
        totalSources: 2,
        completedCount: 1,
      };

      workflowEventEmitter.emitWorkflowPending(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_PENDING,
        { ...payload, canvasId }
      );
    });
  });

  describe('emitWorkflowSourcesMerged', () => {
    it('應呼叫 emitToCanvas 並附加 canvasId', () => {
      const payload = {
        canvasId,
        targetPodId: 'target-1',
        sourcePodIds: ['source-1', 'source-2'],
        mergedContentPreview: 'merged content',
      };

      workflowEventEmitter.emitWorkflowSourcesMerged(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_SOURCES_MERGED,
        { ...payload, canvasId }
      );
    });
  });

  describe('emitWorkflowComplete', () => {
    it('成功時應呼叫 emitToCanvas 並包含 requestId', () => {
      workflowEventEmitter.emitWorkflowComplete({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        success: true,
        triggerMode: 'auto',
      });

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        expect.objectContaining({
          canvasId,
          connectionId: 'conn-1',
          targetPodId: 'target-1',
          success: true,
          triggerMode: 'auto',
          requestId: expect.any(String),
        })
      );
    });

    it('有 error 時應包含 error 欄位', () => {
      workflowEventEmitter.emitWorkflowComplete({
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        success: false,
        error: '執行失敗',
        triggerMode: 'auto',
      });

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_COMPLETE,
        expect.objectContaining({
          error: '執行失敗',
          success: false,
        })
      );
    });
  });

  describe('emitAiDecidePending', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      workflowEventEmitter.emitAiDecidePending(canvasId, ['conn-1', 'conn-2'], 'source-1');

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AI_DECIDE_PENDING,
        { canvasId, connectionIds: ['conn-1', 'conn-2'], sourcePodId: 'source-1' }
      );
    });
  });

  describe('emitAiDecideResult', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const params = {
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        shouldTrigger: true,
        reason: '條件符合',
      };

      workflowEventEmitter.emitAiDecideResult(params);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AI_DECIDE_RESULT,
        params
      );
    });
  });

  describe('emitAiDecideError', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const params = {
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        error: 'AI 決策失敗',
      };

      workflowEventEmitter.emitAiDecideError(params);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AI_DECIDE_ERROR,
        params
      );
    });
  });

  describe('emitAiDecideClear', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      workflowEventEmitter.emitAiDecideClear(canvasId, ['conn-1', 'conn-2']);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AI_DECIDE_CLEAR,
        { canvasId, connectionIds: ['conn-1', 'conn-2'] }
      );
    });
  });

  describe('emitWorkflowAiDecideTriggered', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      workflowEventEmitter.emitWorkflowAiDecideTriggered(canvasId, 'conn-1', 'source-1', 'target-1');

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_AI_DECIDE_TRIGGERED,
        { canvasId, connectionId: 'conn-1', sourcePodId: 'source-1', targetPodId: 'target-1' }
      );
    });
  });

  describe('emitDirectTriggered', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const payload = {
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
        transferredContent: '內容',
        isSummarized: false,
      };

      workflowEventEmitter.emitDirectTriggered(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_DIRECT_TRIGGERED,
        payload
      );
    });
  });

  describe('emitDirectWaiting', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const payload = {
        canvasId,
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        targetPodId: 'target-1',
      };

      workflowEventEmitter.emitDirectWaiting(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_DIRECT_WAITING,
        payload
      );
    });
  });

  describe('emitWorkflowQueued', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const payload = {
        canvasId,
        targetPodId: 'target-1',
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        position: 2,
        queueSize: 3,
        triggerMode: 'auto' as const,
      };

      workflowEventEmitter.emitWorkflowQueued(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_QUEUED,
        payload
      );
    });
  });

  describe('emitWorkflowQueueProcessed', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const payload = {
        canvasId,
        targetPodId: 'target-1',
        connectionId: 'conn-1',
        sourcePodId: 'source-1',
        remainingQueueSize: 1,
        triggerMode: 'direct' as const,
      };

      workflowEventEmitter.emitWorkflowQueueProcessed(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_QUEUE_PROCESSED,
        payload
      );
    });
  });

  describe('emitDirectCountdown', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      workflowEventEmitter.emitDirectCountdown(canvasId, 'target-1', 5, ['source-1', 'source-2']);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_DIRECT_COUNTDOWN,
        { canvasId, targetPodId: 'target-1', remainingSeconds: 5, readySourcePodIds: ['source-1', 'source-2'] }
      );
    });
  });

  describe('emitDirectMerged', () => {
    it('應呼叫 emitToCanvas 並帶入正確 payload', () => {
      const payload = {
        canvasId,
        targetPodId: 'target-1',
        sourcePodIds: ['source-1', 'source-2'],
        mergedContentPreview: '合併內容',
        countdownSeconds: 3,
      };

      workflowEventEmitter.emitDirectMerged(canvasId, payload);

      expect(socketSpy.emitToCanvas).toHaveBeenCalledWith(
        canvasId,
        WebSocketResponseEvents.WORKFLOW_DIRECT_MERGED,
        payload
      );
    });
  });
});
