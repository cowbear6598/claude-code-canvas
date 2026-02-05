import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { PastePodItem, PasteConnectionItem } from '../../src/schemas/index.js';
import type { PasteError } from '../../src/types/index.js';

describe('Paste Helpers', () => {
  let canvasId: string;

  beforeEach(() => {
    canvasId = uuidv4();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPastedPods - Repository 驗證', () => {
    it('當 repository 存在時應正常建立 Pod', async () => {
      const { createPastedPods } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { repositoryService } = await import('../../src/services/repositoryService.js');
      const { podStore } = await import('../../src/services/podStore.js');
      const { workspaceService } = await import('../../src/services/workspace/index.js');
      const { claudeSessionManager } = await import('../../src/services/claude/sessionManager.js');

      const repositoryId = 'test-repo-id';
      const originalPodId = uuidv4();

      // Mock repository 存在
      vi.spyOn(repositoryService, 'exists').mockResolvedValue(true);
      vi.spyOn(repositoryService, 'getRepositoryPath').mockReturnValue('/test/repo/path');

      // Mock podStore.create
      const mockPod = {
        id: uuidv4(),
        name: 'Test Pod',
        color: 'blue' as const,
        x: 100,
        y: 100,
        rotation: 0,
        workspacePath: '/test/workspace',
        repositoryId,
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        commandId: null,
        model: undefined,
        status: 'idle' as const,
        createdAt: new Date(),
        schedule: null,
      };
      vi.spyOn(podStore, 'create').mockReturnValue(mockPod);
      vi.spyOn(podStore, 'getById').mockReturnValue(null);

      // Mock workspace and session
      vi.spyOn(workspaceService, 'createWorkspace').mockResolvedValue(undefined);
      vi.spyOn(claudeSessionManager, 'createSession').mockResolvedValue(undefined);

      const pods: PastePodItem[] = [
        {
          originalId: originalPodId,
          name: 'Test Pod',
          color: 'blue',
          x: 100,
          y: 100,
          rotation: 0,
          repositoryId,
        },
      ];

      const podIdMapping: Record<string, string> = {};
      const errors: PasteError[] = [];

      const createdPods = await createPastedPods(canvasId, pods, podIdMapping, errors);

      expect(createdPods).toHaveLength(1);
      expect(createdPods[0].id).toBe(mockPod.id);
      expect(podIdMapping[originalPodId]).toBe(mockPod.id);
      expect(errors).toHaveLength(0);
      expect(repositoryService.exists).toHaveBeenCalledWith(repositoryId);
    });

    it('當 repository 不存在時應記錄錯誤並繼續', async () => {
      const { createPastedPods } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { repositoryService } = await import('../../src/services/repositoryService.js');

      const nonExistentRepoId = 'non-existent-repo';
      const originalPodId = uuidv4();

      // Mock repository 不存在
      vi.spyOn(repositoryService, 'exists').mockResolvedValue(false);

      const pods: PastePodItem[] = [
        {
          originalId: originalPodId,
          name: 'Test Pod with Invalid Repo',
          color: 'blue',
          x: 100,
          y: 100,
          rotation: 0,
          repositoryId: nonExistentRepoId,
        },
      ];

      const podIdMapping: Record<string, string> = {};
      const errors: PasteError[] = [];

      const createdPods = await createPastedPods(canvasId, pods, podIdMapping, errors);

      expect(createdPods).toHaveLength(0);
      expect(podIdMapping[originalPodId]).toBeUndefined();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: 'pod',
        originalId: originalPodId,
        error: expect.stringContaining('Repository 找不到'),
      });
      expect(repositoryService.exists).toHaveBeenCalledWith(nonExistentRepoId);
    });

    it('當 repository 為 null 時應正常建立 Pod（不驗證 repository）', async () => {
      const { createPastedPods } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { repositoryService } = await import('../../src/services/repositoryService.js');
      const { podStore } = await import('../../src/services/podStore.js');
      const { workspaceService } = await import('../../src/services/workspace/index.js');
      const { claudeSessionManager } = await import('../../src/services/claude/sessionManager.js');

      const originalPodId = uuidv4();

      // 確保 exists 不被呼叫
      const existsSpy = vi.spyOn(repositoryService, 'exists');

      // Mock podStore.create
      const mockPod = {
        id: uuidv4(),
        name: 'Test Pod',
        color: 'blue' as const,
        x: 100,
        y: 100,
        rotation: 0,
        workspacePath: '/test/workspace',
        repositoryId: null,
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        commandId: null,
        model: undefined,
        status: 'idle' as const,
        createdAt: new Date(),
        schedule: null,
      };
      vi.spyOn(podStore, 'create').mockReturnValue(mockPod);
      vi.spyOn(podStore, 'getById').mockReturnValue(null);

      // Mock workspace and session
      vi.spyOn(workspaceService, 'createWorkspace').mockResolvedValue(undefined);
      vi.spyOn(claudeSessionManager, 'createSession').mockResolvedValue(undefined);

      const pods: PastePodItem[] = [
        {
          originalId: originalPodId,
          name: 'Test Pod',
          color: 'blue',
          x: 100,
          y: 100,
          rotation: 0,
          repositoryId: null,
        },
      ];

      const podIdMapping: Record<string, string> = {};
      const errors: PasteError[] = [];

      const createdPods = await createPastedPods(canvasId, pods, podIdMapping, errors);

      expect(createdPods).toHaveLength(1);
      expect(createdPods[0].id).toBe(mockPod.id);
      expect(podIdMapping[originalPodId]).toBe(mockPod.id);
      expect(errors).toHaveLength(0);
      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('應繼續處理其他 Pod 即使其中一個失敗', async () => {
      const { createPastedPods } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { repositoryService } = await import('../../src/services/repositoryService.js');
      const { podStore } = await import('../../src/services/podStore.js');
      const { workspaceService } = await import('../../src/services/workspace/index.js');
      const { claudeSessionManager } = await import('../../src/services/claude/sessionManager.js');

      const failingPodId = uuidv4();
      const successPodId = uuidv4();

      // First pod 的 repository 不存在
      vi.spyOn(repositoryService, 'exists')
        .mockResolvedValueOnce(false) // First call for failing pod
        .mockResolvedValueOnce(true); // Second call for success pod

      vi.spyOn(repositoryService, 'getRepositoryPath').mockReturnValue('/test/repo/path');

      // Mock successful pod creation
      const mockPod = {
        id: uuidv4(),
        name: 'Success Pod',
        color: 'green' as const,
        x: 200,
        y: 200,
        rotation: 0,
        workspacePath: '/test/workspace',
        repositoryId: 'valid-repo',
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        commandId: null,
        model: undefined,
        status: 'idle' as const,
        createdAt: new Date(),
        schedule: null,
      };
      vi.spyOn(podStore, 'create').mockReturnValue(mockPod);
      vi.spyOn(podStore, 'getById').mockReturnValue(null);

      // Mock workspace and session
      vi.spyOn(workspaceService, 'createWorkspace').mockResolvedValue(undefined);
      vi.spyOn(claudeSessionManager, 'createSession').mockResolvedValue(undefined);

      const pods: PastePodItem[] = [
        {
          originalId: failingPodId,
          name: 'Failing Pod',
          color: 'red',
          x: 100,
          y: 100,
          rotation: 0,
          repositoryId: 'invalid-repo',
        },
        {
          originalId: successPodId,
          name: 'Success Pod',
          color: 'green',
          x: 200,
          y: 200,
          rotation: 0,
          repositoryId: 'valid-repo',
        },
      ];

      const podIdMapping: Record<string, string> = {};
      const errors: PasteError[] = [];

      const createdPods = await createPastedPods(canvasId, pods, podIdMapping, errors);

      expect(createdPods).toHaveLength(1);
      expect(createdPods[0].id).toBe(mockPod.id);
      expect(podIdMapping[successPodId]).toBe(mockPod.id);
      expect(podIdMapping[failingPodId]).toBeUndefined();
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('pod');
      expect(errors[0].originalId).toBe(failingPodId);
    });
  });

  describe('createPastedConnections - Connection 重建邏輯', () => {
    it('應使用 podIdMapping 正確重建 connection', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const originalSourcePodId = uuidv4();
      const originalTargetPodId = uuidv4();
      const newSourcePodId = uuidv4();
      const newTargetPodId = uuidv4();

      const podIdMapping: Record<string, string> = {
        [originalSourcePodId]: newSourcePodId,
        [originalTargetPodId]: newTargetPodId,
      };

      const mockConnection = {
        id: uuidv4(),
        sourcePodId: newSourcePodId,
        sourceAnchor: 'right' as const,
        targetPodId: newTargetPodId,
        targetAnchor: 'left' as const,
        autoTrigger: false,
      };

      vi.spyOn(connectionStore, 'create').mockReturnValue(mockConnection);

      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId,
          sourceAnchor: 'right',
          originalTargetPodId,
          targetAnchor: 'left',
          autoTrigger: false,
        },
      ];

      const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

      expect(createdConnections).toHaveLength(1);
      expect(createdConnections[0]).toBe(mockConnection);
      expect(connectionStore.create).toHaveBeenCalledWith(canvasId, {
        sourcePodId: newSourcePodId,
        sourceAnchor: 'right',
        targetPodId: newTargetPodId,
        targetAnchor: 'left',
        autoTrigger: false,
      });
    });

    it('當 source pod 不在 mapping 中時應跳過 connection', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const nonExistentSourcePodId = uuidv4();
      const originalTargetPodId = uuidv4();
      const newTargetPodId = uuidv4();

      const podIdMapping: Record<string, string> = {
        [originalTargetPodId]: newTargetPodId,
        // nonExistentSourcePodId 不在 mapping 中
      };

      const createSpy = vi.spyOn(connectionStore, 'create');

      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId: nonExistentSourcePodId,
          sourceAnchor: 'right',
          originalTargetPodId,
          targetAnchor: 'left',
        },
      ];

      const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

      expect(createdConnections).toHaveLength(0);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('當 target pod 不在 mapping 中時應跳過 connection', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const originalSourcePodId = uuidv4();
      const nonExistentTargetPodId = uuidv4();
      const newSourcePodId = uuidv4();

      const podIdMapping: Record<string, string> = {
        [originalSourcePodId]: newSourcePodId,
        // nonExistentTargetPodId 不在 mapping 中
      };

      const createSpy = vi.spyOn(connectionStore, 'create');

      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId,
          sourceAnchor: 'right',
          originalTargetPodId: nonExistentTargetPodId,
          targetAnchor: 'left',
        },
      ];

      const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

      expect(createdConnections).toHaveLength(0);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('當 source 和 target 都不在 mapping 中時應跳過 connection', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const nonExistentSourcePodId = uuidv4();
      const nonExistentTargetPodId = uuidv4();

      const podIdMapping: Record<string, string> = {};

      const createSpy = vi.spyOn(connectionStore, 'create');

      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId: nonExistentSourcePodId,
          sourceAnchor: 'right',
          originalTargetPodId: nonExistentTargetPodId,
          targetAnchor: 'left',
        },
      ];

      const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

      expect(createdConnections).toHaveLength(0);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('應處理多個 connections 並跳過無效的', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const validSource1 = uuidv4();
      const validTarget1 = uuidv4();
      const validSource2 = uuidv4();
      const validTarget2 = uuidv4();
      const invalidSource = uuidv4();
      const invalidTarget = uuidv4();

      const newSource1 = uuidv4();
      const newTarget1 = uuidv4();
      const newSource2 = uuidv4();
      const newTarget2 = uuidv4();

      const podIdMapping: Record<string, string> = {
        [validSource1]: newSource1,
        [validTarget1]: newTarget1,
        [validSource2]: newSource2,
        [validTarget2]: newTarget2,
        // invalidSource 和 invalidTarget 不在 mapping 中
      };

      const mockConnection1 = {
        id: uuidv4(),
        sourcePodId: newSource1,
        sourceAnchor: 'right' as const,
        targetPodId: newTarget1,
        targetAnchor: 'left' as const,
        autoTrigger: false,
      };

      const mockConnection2 = {
        id: uuidv4(),
        sourcePodId: newSource2,
        sourceAnchor: 'bottom' as const,
        targetPodId: newTarget2,
        targetAnchor: 'top' as const,
        autoTrigger: true,
      };

      vi.spyOn(connectionStore, 'create')
        .mockReturnValueOnce(mockConnection1)
        .mockReturnValueOnce(mockConnection2);

      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId: validSource1,
          sourceAnchor: 'right',
          originalTargetPodId: validTarget1,
          targetAnchor: 'left',
          autoTrigger: false,
        },
        {
          originalSourcePodId: invalidSource,
          sourceAnchor: 'right',
          originalTargetPodId: validTarget1,
          targetAnchor: 'left',
        },
        {
          originalSourcePodId: validSource2,
          sourceAnchor: 'bottom',
          originalTargetPodId: validTarget2,
          targetAnchor: 'top',
          autoTrigger: true,
        },
        {
          originalSourcePodId: validSource1,
          sourceAnchor: 'right',
          originalTargetPodId: invalidTarget,
          targetAnchor: 'left',
        },
      ];

      const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

      expect(createdConnections).toHaveLength(2);
      expect(createdConnections[0]).toBe(mockConnection1);
      expect(createdConnections[1]).toBe(mockConnection2);
      expect(connectionStore.create).toHaveBeenCalledTimes(2);
    });

    it('應正確處理 autoTrigger 預設值', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');
      const { connectionStore } = await import('../../src/services/connectionStore.js');

      const originalSourcePodId = uuidv4();
      const originalTargetPodId = uuidv4();
      const newSourcePodId = uuidv4();
      const newTargetPodId = uuidv4();

      const podIdMapping: Record<string, string> = {
        [originalSourcePodId]: newSourcePodId,
        [originalTargetPodId]: newTargetPodId,
      };

      const mockConnection = {
        id: uuidv4(),
        sourcePodId: newSourcePodId,
        sourceAnchor: 'right' as const,
        targetPodId: newTargetPodId,
        targetAnchor: 'left' as const,
        autoTrigger: false,
      };

      vi.spyOn(connectionStore, 'create').mockReturnValue(mockConnection);

      // 沒有提供 autoTrigger
      const connections: PasteConnectionItem[] = [
        {
          originalSourcePodId,
          sourceAnchor: 'right',
          originalTargetPodId,
          targetAnchor: 'left',
        },
      ];

      createPastedConnections(canvasId, connections, podIdMapping);

      expect(connectionStore.create).toHaveBeenCalledWith(canvasId, {
        sourcePodId: newSourcePodId,
        sourceAnchor: 'right',
        targetPodId: newTargetPodId,
        targetAnchor: 'left',
        autoTrigger: false, // 預設為 false
      });
    });

    it('當 connections 為 undefined 時應回傳空陣列', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');

      const podIdMapping: Record<string, string> = {};

      const createdConnections = createPastedConnections(canvasId, undefined, podIdMapping);

      expect(createdConnections).toHaveLength(0);
    });

    it('當 connections 為空陣列時應回傳空陣列', async () => {
      const { createPastedConnections } = await import('../../src/handlers/paste/pasteHelpers.js');

      const podIdMapping: Record<string, string> = {};

      const createdConnections = createPastedConnections(canvasId, [], podIdMapping);

      expect(createdConnections).toHaveLength(0);
    });
  });
});
