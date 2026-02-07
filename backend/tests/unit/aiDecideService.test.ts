import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';

// Mock @anthropic-ai/claude-agent-sdk（保留此模組的 mock，因為無法對導出的函數使用 spyOn）
mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mock(),
  tool: mock(),
  createSdkMcpServer: mock(),
}));

import { aiDecideService } from '../../src/services/workflow';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { podStore } from '../../src/services/podStore.js';
import { messageStore } from '../../src/services/messageStore.js';
import { outputStyleService } from '../../src/services/outputStyleService.js';
import { commandService } from '../../src/services/commandService.js';
import { disposableChatService } from '../../src/services/claude/disposableChatService.js';
import { summaryPromptBuilder } from '../../src/services/summaryPromptBuilder.js';
import { logger } from '../../src/utils/logger.js';
import type { Connection } from '../../src/types';

describe('AiDecideService', () => {
  const mockSourcePod = {
    id: 'source-pod',
    name: 'Source Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
  };

  const mockTargetPod = {
    id: 'target-pod',
    name: 'Target Pod',
    model: 'claude-sonnet-4-5-20250929' as const,
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle' as const,
  };

  const mockMessages = [
    {
      id: 'msg-1',
      podId: 'source-pod',
      role: 'user' as const,
      content: 'Analyze this data',
      timestamp: Date.now(),
      toolUse: null,
    },
    {
      id: 'msg-2',
      podId: 'source-pod',
      role: 'assistant' as const,
      content: 'Analysis complete: found 3 issues',
      timestamp: Date.now(),
      toolUse: null,
    },
  ];

  const mockConnection: Connection = {
    id: 'conn-1',
    sourcePodId: 'source-pod',
    sourceAnchor: 'right',
    targetPodId: 'target-pod',
    targetAnchor: 'left',
    triggerMode: 'ai-decide',
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    createdAt: new Date(),
  };

  // 追蹤所有在測試中創建的 spy，以便在 afterEach 中還原
  let spies: Array<ReturnType<typeof spyOn>> = [];

  /**
   * 輔助函數：安全地 spy 或重置已存在的 mock
   * 如果方法已經是 mock（由其他測試的 mock.module 建立），則重置它
   * 否則建立新的 spy
   */
  const setupMock = <T extends object, K extends keyof T>(
    obj: T,
    method: K,
    mockConfig: { returnValue?: any; implementation?: any; resolvedValue?: any }
  ) => {
    const target = obj[method];

    // 如果目標不存在或是 undefined，說明被其他測試的 mock.module 污染但沒有正確初始化
    // 我們需要創建一個新的 mock 函數
    if (target === undefined || target === null) {
      const newMock = mock();
      (obj as any)[method] = newMock;

      if ('returnValue' in mockConfig) {
        newMock.mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        newMock.mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        newMock.mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為這是替換已污染的模組
    }

    // 檢查是否已經是 mock 函數（由其他測試的 mock.module 建立）
    if (typeof target === 'function' && 'mockReturnValue' in target) {
      // 已經是 mock，清空並重新設定
      (target as any).mockClear?.();
      if ('returnValue' in mockConfig) {
        (target as any).mockReturnValue(mockConfig.returnValue);
      } else if ('implementation' in mockConfig) {
        (target as any).mockImplementation(mockConfig.implementation);
      } else if ('resolvedValue' in mockConfig) {
        (target as any).mockResolvedValue(mockConfig.resolvedValue);
      }
      return; // 不加入 spies，因為不是我們創建的
    }

    // 真實函數，使用 spyOn
    const spy = spyOn(obj, method as any);
    if ('returnValue' in mockConfig) {
      spy.mockReturnValue(mockConfig.returnValue);
    } else if ('implementation' in mockConfig) {
      spy.mockImplementation(mockConfig.implementation);
    } else if ('resolvedValue' in mockConfig) {
      spy.mockResolvedValue(mockConfig.resolvedValue);
    }
    spies.push(spy);
  };

  beforeEach(() => {
    // 清空 spy 陣列
    spies = [];

    // podStore
    setupMock(podStore, 'getById', {
      implementation: (canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return mockTargetPod;
        return null;
      }
    });

    // messageStore
    setupMock(messageStore, 'getMessages', { returnValue: mockMessages });

    // outputStyleService
    setupMock(outputStyleService, 'getContent', { resolvedValue: null });

    // commandService
    setupMock(commandService, 'getContent', { resolvedValue: null });

    // disposableChatService
    setupMock(disposableChatService, 'executeDisposableChat', {
      resolvedValue: {
        success: true,
        content: 'Summary: Analysis found 3 issues',
      }
    });

    // summaryPromptBuilder
    setupMock(summaryPromptBuilder, 'formatConversationHistory', {
      returnValue: '[User]: Hello\n\n[Assistant]: Hi'
    });

    // logger
    setupMock(logger, 'log', { implementation: () => {} });
    setupMock(logger, 'error', { implementation: () => {} });

    // @anthropic-ai/claude-agent-sdk 使用 mock.module，需要手動重置
    (query as any).mockClear?.();
    (tool as any).mockClear?.();
    (createSdkMcpServer as any).mockClear?.();

    // 設定預設行為
    (tool as any).mockImplementation((name: string, desc: string, schema: any, handler: any) => {
      return { name, desc, schema, handler };
    });
    (createSdkMcpServer as any).mockImplementation((config: any) => {
      return { name: config.name, tools: config.tools };
    });
    (query as any).mockImplementation(async function* () {
      yield { type: 'result', subtype: 'success' };
    });
  });

  afterEach(() => {
    // 還原所有測試中創建的 spy，避免跨檔案污染
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies = [];
  });

  describe('AI Decide 單一 connection 判斷為觸發（shouldTrigger = true）', () => {
    it('正確回傳 shouldTrigger: true 和 reason', async () => {
      // Mock query 函式，模擬 AI 呼叫 Custom Tool
      (query as any).mockImplementation(async function* (config: any) {
        // 取得 tool handler
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        // 模擬 AI 呼叫 tool
        await decideTool.handler({
          decisions: [
            {
              connectionId: 'conn-1',
              shouldTrigger: true,
              reason: '上游分析結果與下游需求相關',
            },
          ],
        });

        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [mockConnection]);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].connectionId).toBe('conn-1');
      expect(result.results[0].shouldTrigger).toBe(true);
      expect(result.results[0].reason).toBe('上游分析結果與下游需求相關');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('AI Decide 單一 connection 判斷為不觸發（shouldTrigger = false），包含 reason', () => {
    it('正確回傳 shouldTrigger: false 和 reason', async () => {
      (query as any).mockImplementation(async function* (config: any) {
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        await decideTool.handler({
          decisions: [
            {
              connectionId: 'conn-1',
              shouldTrigger: false,
              reason: '上游產出與下游任務無關',
            },
          ],
        });

        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [mockConnection]);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].connectionId).toBe('conn-1');
      expect(result.results[0].shouldTrigger).toBe(false);
      expect(result.results[0].reason).toBe('上游產出與下游任務無關');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('AI Decide 批次判斷多條 connections，全部觸發', () => {
    it('正確回傳所有 connections 的判斷結果', async () => {
      const mockConnection2: Connection = {
        ...mockConnection,
        id: 'conn-2',
        targetPodId: 'target-pod-2',
      };
      const mockConnection3: Connection = {
        ...mockConnection,
        id: 'conn-3',
        targetPodId: 'target-pod-3',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId.startsWith('target-pod')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
        return null;
      });

      (query as any).mockImplementation(async function* (config: any) {
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        await decideTool.handler({
          decisions: [
            { connectionId: 'conn-1', shouldTrigger: true, reason: '相關任務 1' },
            { connectionId: 'conn-2', shouldTrigger: true, reason: '相關任務 2' },
            { connectionId: 'conn-3', shouldTrigger: true, reason: '相關任務 3' },
          ],
        });

        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [
        mockConnection,
        mockConnection2,
        mockConnection3,
      ]);

      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(query).toHaveBeenCalledTimes(1); // 批次處理，只呼叫一次
    });
  });

  describe('AI Decide 批次判斷多條 connections，部分觸發部分不觸發', () => {
    it('正確回傳混合的判斷結果', async () => {
      const mockConnection2: Connection = {
        ...mockConnection,
        id: 'conn-2',
        targetPodId: 'target-pod-2',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId.startsWith('target-pod')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
        return null;
      });

      (query as any).mockImplementation(async function* (config: any) {
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        await decideTool.handler({
          decisions: [
            { connectionId: 'conn-1', shouldTrigger: true, reason: '相關任務' },
            { connectionId: 'conn-2', shouldTrigger: false, reason: '不相關任務' },
          ],
        });

        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [
        mockConnection,
        mockConnection2,
      ]);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].shouldTrigger).toBe(true);
      expect(result.results[1].shouldTrigger).toBe(false);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('AI Decide 批次判斷中缺少某條 connection 的結果（部分失敗）', () => {
    it('缺少結果的 connection 進入 errors 陣列', async () => {
      const mockConnection2: Connection = {
        ...mockConnection,
        id: 'conn-2',
        targetPodId: 'target-pod-2',
      };
      const mockConnection3: Connection = {
        ...mockConnection,
        id: 'conn-3',
        targetPodId: 'target-pod-3',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId.startsWith('target-pod')) return { ...mockTargetPod, id: podId, name: `Target ${podId}` };
        return null;
      });

      (query as any).mockImplementation(async function* (config: any) {
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        // 只回傳 2 條結果，conn-3 缺失
        await decideTool.handler({
          decisions: [
            { connectionId: 'conn-1', shouldTrigger: true, reason: '相關任務 1' },
            { connectionId: 'conn-2', shouldTrigger: false, reason: '不相關任務 2' },
          ],
        });

        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [
        mockConnection,
        mockConnection2,
        mockConnection3,
      ]);

      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].connectionId).toBe('conn-3');
      expect(result.errors[0].error).toBe('No decision returned for this connection');
    });
  });

  describe('Claude API 請求失敗時的錯誤處理', () => {
    it('所有 connections 進入 errors 陣列', async () => {
      // Mock query 拋出錯誤
      (query as any).mockImplementation(() => {
        throw new Error('Claude API Error');
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [mockConnection]);

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].connectionId).toBe('conn-1');
      expect(result.errors[0].error).toContain('Claude API Error');
    });
  });

  describe('Custom Tool handler 未被呼叫時的錯誤處理', () => {
    it('所有 connections 進入 errors 陣列', async () => {
      // Mock query 但不呼叫 tool handler
      (query as any).mockImplementation(async function* () {
        yield { type: 'result', subtype: 'success' };
      });

      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', [mockConnection]);

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].connectionId).toBe('conn-1');
      expect(result.errors[0].error).toBe('AI decision tool was not executed');
    });
  });

  describe('正確組裝 prompt（包含 source 摘要、target OutputStyle、target Command）', () => {
    it('傳給 query 的 messages 包含正確資訊', async () => {
      const targetPodWithResources = {
        ...mockTargetPod,
        outputStyleId: 'style-1',
        commandId: 'command-1',
      };

      (podStore.getById as any).mockImplementation((canvasId: string, podId: string) => {
        if (podId === 'source-pod') return mockSourcePod;
        if (podId === 'target-pod') return targetPodWithResources;
        return null;
      });

      (outputStyleService.getContent as any).mockResolvedValue('You are a code reviewer.');
      (commandService.getContent as any).mockResolvedValue('Review the code for bugs.');

      (query as any).mockImplementation(async function* (config: any) {
        const mcpServer = config.options.mcpServers['ai-decide'];
        const decideTool = mcpServer.tools[0];

        await decideTool.handler({
          decisions: [{ connectionId: 'conn-1', shouldTrigger: true, reason: '相關' }],
        });

        yield { type: 'result', subtype: 'success' };
      });

      await aiDecideService.decideConnections('canvas-1', 'source-pod', [mockConnection]);

      expect(query).toHaveBeenCalledTimes(1);
      const queryConfig = (query as any).mock.calls[0][0];

      // 驗證 prompt 包含必要資訊
      expect(queryConfig.prompt).toContain('Target Pod');
      expect(queryConfig.options.systemPrompt).toContain('Workflow 觸發判斷者');

      // 驗證 OutputStyle 和 Command 被讀取
      expect(outputStyleService.getContent).toHaveBeenCalledWith('style-1');
      expect(commandService.getContent).toHaveBeenCalledWith('command-1');
    });
  });

  describe('空的 ai-decide connections 陣列時直接回傳空結果', () => {
    it('不呼叫 Claude API，直接回傳空結果', async () => {
      const result = await aiDecideService.decideConnections('canvas-1', 'source-pod', []);

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(query).not.toHaveBeenCalled();
    });
  });
});
