// Mock dependencies
vi.mock('../../src/services/workflow/aiDecideService.js', () => ({
  aiDecideService: {
    decideConnections: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowEventEmitter.js', () => ({
  workflowEventEmitter: {
    emitAiDecidePending: vi.fn(),
    emitAiDecideResult: vi.fn(),
    emitAiDecideError: vi.fn(),
    emitWorkflowComplete: vi.fn(),
  },
}));

vi.mock('../../src/services/connectionStore.js', () => ({
  connectionStore: {
    updateDecideStatus: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowStateService.js', () => ({
  workflowStateService: {
    checkMultiInputScenario: vi.fn(),
    recordSourceRejection: vi.fn(),
  },
}));

vi.mock('../../src/services/pendingTargetStore.js', () => ({
  pendingTargetStore: {
    hasPendingTarget: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowPipeline.js', () => ({
  workflowPipeline: {
    execute: vi.fn(),
  },
}));

vi.mock('../../src/services/workflow/workflowMultiInputService.js', () => ({
  workflowMultiInputService: {
    emitPendingStatus: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/errorHelpers.js', () => ({
  getErrorMessage: vi.fn((e) => e?.message ?? String(e)),
}));

// Import after mocks
import { workflowAiDecideTriggerService } from '../../src/services/workflow/workflowAiDecideTriggerService.js';
import { aiDecideService } from '../../src/services/workflow/aiDecideService.js';
import { workflowEventEmitter } from '../../src/services/workflow/workflowEventEmitter.js';
import { connectionStore } from '../../src/services/connectionStore.js';
import { workflowStateService } from '../../src/services/workflow/workflowStateService.js';
import { pendingTargetStore } from '../../src/services/pendingTargetStore.js';
import { workflowPipeline } from '../../src/services/workflow/workflowPipeline.js';
import { workflowMultiInputService } from '../../src/services/workflow/workflowMultiInputService.js';
import { logger } from '../../src/utils/logger.js';
import type { Connection } from '../../src/types';

describe('WorkflowAiDecideTriggerService', () => {
  const canvasId = 'canvas-1';
  const sourcePodId = 'source-pod';

  const mockConnection: Connection = {
    id: 'conn-ai-1',
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId: 'target-pod',
    targetAnchor: 'left',
    triggerMode: 'ai-decide',
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 初始化 service
    workflowAiDecideTriggerService.init(
      aiDecideService,
      workflowEventEmitter,
      connectionStore,
      workflowStateService,
      pendingTargetStore,
      workflowPipeline,
      workflowMultiInputService
    );

    // 預設 mock 回傳值
    (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
      isMultiInput: false,
      requiredSourcePodIds: [],
    });
    (pendingTargetStore.hasPendingTarget as any).mockReturnValue(false);
    (workflowPipeline.execute as any).mockResolvedValue(undefined);
  });

  describe('decide() - 批次決策格式轉換', () => {
    it('正確轉換 aiDecideService 的成功結果為 TriggerDecideResult 格式', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務' },
        ],
        errors: [],
      });

      const results = await workflowAiDecideTriggerService.decide({
        canvasId,
        sourcePodId,
        connections: [mockConnection],
      });

      expect(results).toEqual([
        {
          connectionId: 'conn-ai-1',
          approved: true,
          reason: '相關任務',
        },
      ]);
    });

    it('正確轉換 aiDecideService 的錯誤結果為 approved=false 格式', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [],
        errors: [
          { connectionId: 'conn-ai-1', error: 'AI 決策失敗' },
        ],
      });

      const results = await workflowAiDecideTriggerService.decide({
        canvasId,
        sourcePodId,
        connections: [mockConnection],
      });

      expect(results).toEqual([
        {
          connectionId: 'conn-ai-1',
          approved: false,
          reason: '錯誤：AI 決策失敗',
        },
      ]);
    });

    it('當 aiDecideService 拋出錯誤時，所有 connection 標記為錯誤', async () => {
      (aiDecideService.decideConnections as any).mockRejectedValue(new Error('網路錯誤'));

      const results = await workflowAiDecideTriggerService.decide({
        canvasId,
        sourcePodId,
        connections: [mockConnection],
      });

      expect(results).toEqual([
        {
          connectionId: 'conn-ai-1',
          approved: false,
          reason: '錯誤：網路錯誤',
        },
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        'Workflow',
        'Error',
        '[AI-Decide] aiDecideService.decideConnections 失敗',
        expect.any(Error)
      );
    });
  });

  describe('processAiDecideConnections() - 完整批次判斷流程', () => {
    it('批次決策 approved 的 connection 進入 Pipeline', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務' },
        ],
        errors: [],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證發送 PENDING 事件
      expect(workflowEventEmitter.emitAiDecidePending).toHaveBeenCalledWith(
        canvasId,
        ['conn-ai-1'],
        sourcePodId
      );

      // 驗證狀態更新順序
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledTimes(2);
      expect(connectionStore.updateDecideStatus).toHaveBeenNthCalledWith(
        1,
        canvasId,
        'conn-ai-1',
        'pending',
        null
      );
      expect(connectionStore.updateDecideStatus).toHaveBeenNthCalledWith(
        2,
        canvasId,
        'conn-ai-1',
        'approved',
        '相關任務'
      );

      // 驗證發送決策結果事件
      expect(workflowEventEmitter.emitAiDecideResult).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod',
        true,
        '相關任務'
      );

      // 驗證呼叫 pipeline.execute
      expect(workflowPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          canvasId,
          sourcePodId,
          connection: mockConnection,
          triggerMode: 'ai-decide',
          decideResult: {
            connectionId: 'conn-ai-1',
            approved: true,
            reason: '相關任務',
          },
        }),
        workflowAiDecideTriggerService
      );

      // 驗證 logger
      expect(logger.log).toHaveBeenCalledWith(
        'Workflow',
        'Create',
        expect.stringContaining('AI Decide approved connection conn-ai-1')
      );
    });

    it('批次決策 rejected 的 connection 更新狀態並發送事件', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: false, reason: '不相關' },
        ],
        errors: [],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證狀態更新為 rejected
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'rejected',
        '不相關'
      );

      // 驗證發送決策結果事件
      expect(workflowEventEmitter.emitAiDecideResult).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod',
        false,
        '不相關'
      );

      // 驗證不應呼叫 pipeline.execute
      expect(workflowPipeline.execute).not.toHaveBeenCalled();

      // 驗證 logger
      expect(logger.log).toHaveBeenCalledWith(
        'Workflow',
        'Update',
        expect.stringContaining('AI Decide rejected connection conn-ai-1')
      );
    });

    it('批次決策 error 時所有 connection 標記為 error', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [],
        errors: [
          { connectionId: 'conn-ai-1', error: 'AI 決策失敗' },
        ],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證狀態更新為 error
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'error',
        '錯誤：AI 決策失敗'
      );

      // 驗證發送錯誤事件
      expect(workflowEventEmitter.emitAiDecideError).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod',
        '錯誤：AI 決策失敗'
      );

      // 驗證不應呼叫 pipeline.execute
      expect(workflowPipeline.execute).not.toHaveBeenCalled();

      // 驗證 logger
      expect(logger.error).toHaveBeenCalledWith(
        'Workflow',
        'Error',
        expect.stringContaining('AI Decide error for connection conn-ai-1')
      );
    });

    it('aiDecideService.decideConnections 拋出錯誤時所有 connection 標記為 error', async () => {
      (aiDecideService.decideConnections as any).mockRejectedValue(new Error('網路錯誤'));

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證狀態更新為 error
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'error',
        '錯誤：網路錯誤'
      );

      // 驗證發送錯誤事件
      expect(workflowEventEmitter.emitAiDecideError).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod',
        '錯誤：網路錯誤'
      );

      // 驗證不應呼叫 pipeline.execute
      expect(workflowPipeline.execute).not.toHaveBeenCalled();
    });

    it('PENDING 事件在決策前正確發送', async () => {
      const callOrder: string[] = [];

      (workflowEventEmitter.emitAiDecidePending as any).mockImplementation(() => {
        callOrder.push('emitAiDecidePending');
      });

      (connectionStore.updateDecideStatus as any).mockImplementation(
        (cId: string, connId: string, status: string) => {
          if (status === 'pending') {
            callOrder.push('updateDecideStatus-pending');
          } else if (status === 'approved') {
            callOrder.push('updateDecideStatus-approved');
          }
        }
      );

      (aiDecideService.decideConnections as any).mockImplementation(async () => {
        callOrder.push('decide');
        return {
          results: [
            { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務' },
          ],
          errors: [],
        };
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證呼叫順序
      expect(callOrder).toEqual([
        'emitAiDecidePending',
        'updateDecideStatus-pending',
        'decide',
        'updateDecideStatus-approved',
      ]);
    });

    it('rejected 時多輸入場景下記錄 rejection', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: false, reason: '不相關' },
        ],
        errors: [],
      });

      (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: true,
        requiredSourcePodIds: [sourcePodId, 'other-source'],
      });

      (pendingTargetStore.hasPendingTarget as any).mockReturnValue(true);

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證記錄 rejection
      expect(workflowStateService.recordSourceRejection).toHaveBeenCalledWith(
        'target-pod',
        sourcePodId,
        '不相關'
      );

      // 驗證發送 pending 狀態
      expect(workflowMultiInputService.emitPendingStatus).toHaveBeenCalledWith(
        canvasId,
        'target-pod'
      );
    });

    it('rejected 時非多輸入場景不記錄 rejection', async () => {
      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: false, reason: '不相關' },
        ],
        errors: [],
      });

      (workflowStateService.checkMultiInputScenario as any).mockReturnValue({
        isMultiInput: false,
        requiredSourcePodIds: [],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 驗證不應記錄 rejection
      expect(workflowStateService.recordSourceRejection).not.toHaveBeenCalled();
      expect(workflowMultiInputService.emitPendingStatus).not.toHaveBeenCalled();
    });

    it('多個 connections 批次處理', async () => {
      const conn2: Connection = {
        ...mockConnection,
        id: 'conn-ai-2',
        targetPodId: 'target-pod-2',
      };

      const conn3: Connection = {
        ...mockConnection,
        id: 'conn-ai-3',
        targetPodId: 'target-pod-3',
      };

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務 1' },
          { connectionId: 'conn-ai-2', shouldTrigger: false, reason: '不相關任務 2' },
        ],
        errors: [
          { connectionId: 'conn-ai-3', error: 'AI 決策失敗' },
        ],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection, conn2, conn3]
      );

      // 驗證 PENDING 事件包含所有 connections
      expect(workflowEventEmitter.emitAiDecidePending).toHaveBeenCalledWith(
        canvasId,
        ['conn-ai-1', 'conn-ai-2', 'conn-ai-3'],
        sourcePodId
      );

      // 驗證 conn-ai-1 approved
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'approved',
        '相關任務 1'
      );
      expect(workflowPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: mockConnection,
          triggerMode: 'ai-decide',
        }),
        workflowAiDecideTriggerService
      );

      // 驗證 conn-ai-2 rejected
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-2',
        'rejected',
        '不相關任務 2'
      );

      // 驗證 conn-ai-3 error
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-3',
        'error',
        '錯誤：AI 決策失敗'
      );
      expect(workflowEventEmitter.emitAiDecideError).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-3',
        sourcePodId,
        'target-pod-3',
        '錯誤：AI 決策失敗'
      );
    });
  });

  describe('錯誤處理', () => {
    it('未初始化時呼叫 decide() 拋出錯誤', async () => {
      // 建立新的未初始化 service 實例（透過直接訪問 class）
      const uninitializedService = Object.create(
        Object.getPrototypeOf(workflowAiDecideTriggerService)
      );

      await expect(
        uninitializedService.decide({
          canvasId,
          sourcePodId,
          connections: [mockConnection],
        })
      ).rejects.toThrow('WorkflowAiDecideTriggerService 尚未初始化，請先呼叫 init()');
    });

    it('未初始化時呼叫 processAiDecideConnections() 拋出錯誤', async () => {
      // 建立新的未初始化 service 實例
      const uninitializedService = Object.create(
        Object.getPrototypeOf(workflowAiDecideTriggerService)
      );

      await expect(
        uninitializedService.processAiDecideConnections(canvasId, sourcePodId, [mockConnection])
      ).rejects.toThrow('WorkflowAiDecideTriggerService 尚未初始化，請先呼叫 init()');
    });

    it('pipeline.execute 拋出錯誤時記錄但不影響流程', async () => {
      const pipelineError = new Error('Pipeline 執行失敗');
      (workflowPipeline.execute as any).mockRejectedValue(pipelineError);

      (aiDecideService.decideConnections as any).mockResolvedValue({
        results: [
          { connectionId: 'conn-ai-1', shouldTrigger: true, reason: '相關任務' },
        ],
        errors: [],
      });

      await workflowAiDecideTriggerService.processAiDecideConnections(
        canvasId,
        sourcePodId,
        [mockConnection]
      );

      // 等待 Promise 完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 驗證仍正常更新狀態
      expect(connectionStore.updateDecideStatus).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        'approved',
        '相關任務'
      );

      // 驗證錯誤被記錄
      expect(logger.error).toHaveBeenCalledWith(
        'Workflow',
        'Error',
        expect.stringContaining('Failed to execute AI-decided workflow'),
        pipelineError
      );

      // 驗證錯誤事件被發送
      expect(workflowEventEmitter.emitWorkflowComplete).toHaveBeenCalledWith(
        canvasId,
        'conn-ai-1',
        sourcePodId,
        'target-pod',
        false,
        'Pipeline 執行失敗',
        'ai-decide'
      );
    });
  });

  describe('mode 屬性', () => {
    it('mode 應為 "ai-decide"', () => {
      expect(workflowAiDecideTriggerService.mode).toBe('ai-decide');
    });
  });
});
