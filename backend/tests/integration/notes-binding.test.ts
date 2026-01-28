// Phase 5: Notes/Binding Flow 測試
// 測試 OutputStyle, Skill, Repository, SubAgent 的 Note 管理和綁定

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  testConfig,
  type TestServerInstance,
} from '../setup/index.js';
import {
  createTestPodPayload,
  createTestOutputStyleNotePayload,
  createTestSkillNotePayload,
  createTestRepositoryNotePayload,
  createTestSubAgentNotePayload,
} from '../fixtures/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type OutputStyleListPayload,
  type OutputStyleListResultPayload,
  type NoteCreatePayload,
  type NoteCreatedPayload,
  type NoteUpdatePayload,
  type NoteUpdatedPayload,
  type NoteDeletePayload,
  type NoteDeletedPayload,
  type PodBindOutputStylePayload,
  type PodOutputStyleBoundPayload,
  type PodUnbindOutputStylePayload,
  type PodOutputStyleUnboundPayload,
  type OutputStyleDeletePayload,
  type OutputStyleDeletedPayload,
  type SkillListPayload,
  type SkillListResultPayload,
  type SkillNoteCreatePayload,
  type SkillNoteCreatedPayload,
  type PodBindSkillPayload,
  type PodSkillBoundPayload,
  type SkillDeletePayload,
  type SkillDeletedPayload,
  type RepositoryListPayload,
  type RepositoryListResultPayload,
  type RepositoryCreatePayload,
  type RepositoryCreatedPayload,
  type RepositoryNoteCreatePayload,
  type RepositoryNoteCreatedPayload,
  type PodBindRepositoryPayload,
  type PodRepositoryBoundPayload,
  type PodUnbindRepositoryPayload,
  type PodRepositoryUnboundPayload,
  type RepositoryDeletePayload,
  type RepositoryDeletedPayload,
  type SubAgentListPayload,
  type SubAgentListResultPayload,
  type SubAgentNoteCreatePayload,
  type SubAgentNoteCreatedPayload,
  type PodBindSubAgentPayload,
  type PodSubAgentBoundPayload,
  type SubAgentDeletePayload,
  type SubAgentDeletedPayload,
} from '../../src/types/index.js';

describe('Phase 5: Notes/Binding Flow', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl);
  });

  afterEach(async () => {
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  describe('OutputStyle Note 管理', () => {
    it('應能列出可用的 OutputStyle', async () => {
      // 建立 Mock OutputStyle 檔案
      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      const outputStyleContent = `# Test Output Style\n\nThis is a test output style.`;
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        outputStyleContent
      );

      const payload: OutputStyleListPayload = { requestId: uuidv4() };
      const response = await emitAndWaitResponse<
        OutputStyleListPayload,
        OutputStyleListResultPayload
      >(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_LIST,
        WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.styles).toBeDefined();
      expect(response.styles?.length).toBeGreaterThan(0);
      const testStyle = response.styles?.find((s) => s.id === 'test-style');
      expect(testStyle).toBeDefined();
      expect(testStyle?.name).toBe('test-style');
    });

    it('應能建立 OutputStyle Note', async () => {
      // 確保 OutputStyle 存在
      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      const payload: NoteCreatePayload = createTestOutputStyleNotePayload('test-style', {
        name: 'Test OutputStyle Note',
        x: 200,
        y: 200,
      });

      const response = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.note).toBeDefined();
      expect(response.note?.id).toBeDefined();
      expect(response.note?.outputStyleId).toBe('test-style');
      expect(response.note?.name).toBe('Test OutputStyle Note');
      expect(response.note?.x).toBe(200);
      expect(response.note?.y).toBe(200);
      expect(response.note?.boundToPodId).toBeNull();
    });

    it('應能更新 Note 位置', async () => {
      // 建立 OutputStyle 和 Note
      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      const createPayload: NoteCreatePayload = createTestOutputStyleNotePayload('test-style');
      const createResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        createPayload
      );

      const noteId = createResponse.note!.id;

      // 更新位置
      const updatePayload: NoteUpdatePayload = {
        requestId: uuidv4(),
        noteId,
        x: 150,
        y: 250,
      };

      const updateResponse = await emitAndWaitResponse<NoteUpdatePayload, NoteUpdatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_UPDATE,
        WebSocketResponseEvents.NOTE_UPDATED,
        updatePayload
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.note?.x).toBe(150);
      expect(updateResponse.note?.y).toBe(250);
    });

    it('應能刪除 Note', async () => {
      // 建立 OutputStyle 和 Note
      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      const createPayload: NoteCreatePayload = createTestOutputStyleNotePayload('test-style');
      const createResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        createPayload
      );

      const noteId = createResponse.note!.id;

      // 刪除 Note
      const deletePayload: NoteDeletePayload = {
        requestId: uuidv4(),
        noteId,
      };

      const deleteResponse = await emitAndWaitResponse<NoteDeletePayload, NoteDeletedPayload>(
        client,
        WebSocketRequestEvents.NOTE_DELETE,
        WebSocketResponseEvents.NOTE_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.noteId).toBe(noteId);
    });

    it('應能綁定 OutputStyle 到 Pod', async () => {
      // 建立 Pod
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      // 建立 OutputStyle
      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      // 綁定 OutputStyle
      const bindPayload: PodBindOutputStylePayload = {
        requestId: uuidv4(),
        podId,
        outputStyleId: 'test-style',
      };

      const bindResponse = await emitAndWaitResponse<
        PodBindOutputStylePayload,
        PodOutputStyleBoundPayload
      >(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        bindPayload
      );

      expect(bindResponse.success).toBe(true);
      expect(bindResponse.pod?.outputStyleId).toBe('test-style');
    });

    it('應能解除 Pod 的 OutputStyle 綁定', async () => {
      // 建立 Pod 並綁定 OutputStyle
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      const bindPayload: PodBindOutputStylePayload = {
        requestId: uuidv4(),
        podId,
        outputStyleId: 'test-style',
      };

      await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        bindPayload
      );

      // 解除綁定
      const unbindPayload: PodUnbindOutputStylePayload = {
        requestId: uuidv4(),
        podId,
      };

      const unbindResponse = await emitAndWaitResponse<
        PodUnbindOutputStylePayload,
        PodOutputStyleUnboundPayload
      >(
        client,
        WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
        unbindPayload
      );

      expect(unbindResponse.success).toBe(true);
      expect(unbindResponse.pod?.outputStyleId).toBeNull();
    });

    it('刪除 OutputStyle 時應檢查是否被使用', async () => {
      // 建立 Pod 並綁定 OutputStyle
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.outputStylesPath, 'test-style.md'),
        '# Test Style'
      );

      const bindPayload: PodBindOutputStylePayload = {
        requestId: uuidv4(),
        podId,
        outputStyleId: 'test-style',
      };

      await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        bindPayload
      );

      // 嘗試刪除 OutputStyle
      const deletePayload: OutputStyleDeletePayload = {
        requestId: uuidv4(),
        outputStyleId: 'test-style',
      };

      const deleteResponse = await emitAndWaitResponse<
        OutputStyleDeletePayload,
        OutputStyleDeletedPayload
      >(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
        WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('in use');
    });
  });

  describe('Skill Note 管理', () => {
    it('應能列出可用的 Skill', async () => {
      // 建立 Mock Skill 目錄
      await fs.mkdir(testConfig.skillsPath, { recursive: true });
      const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
      await fs.mkdir(testSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(testSkillDir, 'SKILL.md'),
        '# Test Skill\n\nThis is a test skill.'
      );

      const payload: SkillListPayload = { requestId: uuidv4() };
      const response = await emitAndWaitResponse<SkillListPayload, SkillListResultPayload>(
        client,
        WebSocketRequestEvents.SKILL_LIST,
        WebSocketResponseEvents.SKILL_LIST_RESULT,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.skills).toBeDefined();
      expect(response.skills?.length).toBeGreaterThan(0);
      const testSkill = response.skills?.find((s) => s.id === 'test-skill');
      expect(testSkill).toBeDefined();
      expect(testSkill?.name).toBe('test-skill');
    });

    it('應能建立 Skill Note', async () => {
      // 建立 Mock Skill
      await fs.mkdir(testConfig.skillsPath, { recursive: true });
      const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
      await fs.mkdir(testSkillDir, { recursive: true });
      await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill');

      const payload: SkillNoteCreatePayload = createTestSkillNotePayload('test-skill', {
        name: 'Test Skill Note',
        x: 300,
        y: 300,
      });

      const response = await emitAndWaitResponse<
        SkillNoteCreatePayload,
        SkillNoteCreatedPayload
      >(
        client,
        WebSocketRequestEvents.SKILL_NOTE_CREATE,
        WebSocketResponseEvents.SKILL_NOTE_CREATED,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.note).toBeDefined();
      expect(response.note?.skillId).toBe('test-skill');
      expect(response.note?.name).toBe('Test Skill Note');
    });

    it('應能綁定 Skill 到 Pod', async () => {
      // 建立 Pod
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      // 建立 Mock Skill
      await fs.mkdir(testConfig.skillsPath, { recursive: true });
      const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
      await fs.mkdir(testSkillDir, { recursive: true });
      await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill');

      // 綁定 Skill
      const bindPayload: PodBindSkillPayload = {
        requestId: uuidv4(),
        podId,
        skillId: 'test-skill',
      };

      const bindResponse = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        bindPayload
      );

      expect(bindResponse.success).toBe(true);
      expect(bindResponse.pod?.skillIds).toContain('test-skill');
    });

    it('重複綁定相同 Skill 應回傳錯誤', async () => {
      // 建立 Pod 並綁定 Skill
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.skillsPath, { recursive: true });
      const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
      await fs.mkdir(testSkillDir, { recursive: true });
      await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill');

      const bindPayload: PodBindSkillPayload = {
        requestId: uuidv4(),
        podId,
        skillId: 'test-skill',
      };

      await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        bindPayload
      );

      // 再次綁定相同 Skill
      const bindPayload2: PodBindSkillPayload = {
        requestId: uuidv4(),
        podId,
        skillId: 'test-skill',
      };

      const bindResponse2 = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        bindPayload2
      );

      expect(bindResponse2.success).toBe(false);
      expect(bindResponse2.error).toBeDefined();
      expect(bindResponse2.error).toContain('already bound');
    });

    it('刪除 Skill 時應檢查是否被使用', async () => {
      // 建立 Pod 並綁定 Skill
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.skillsPath, { recursive: true });
      const testSkillDir = path.join(testConfig.skillsPath, 'test-skill');
      await fs.mkdir(testSkillDir, { recursive: true });
      await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill');

      const bindPayload: PodBindSkillPayload = {
        requestId: uuidv4(),
        podId,
        skillId: 'test-skill',
      };

      await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        bindPayload
      );

      // 嘗試刪除 Skill
      const deletePayload: SkillDeletePayload = {
        requestId: uuidv4(),
        skillId: 'test-skill',
      };

      const deleteResponse = await emitAndWaitResponse<SkillDeletePayload, SkillDeletedPayload>(
        client,
        WebSocketRequestEvents.SKILL_DELETE,
        WebSocketResponseEvents.SKILL_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('in use');
    });
  });

  describe('Repository 管理', () => {
    it('應能列出可用的 Repository', async () => {
      const payload: RepositoryListPayload = { requestId: uuidv4() };
      const response = await emitAndWaitResponse<
        RepositoryListPayload,
        RepositoryListResultPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_LIST,
        WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.repositories).toBeDefined();
      expect(Array.isArray(response.repositories)).toBe(true);
    });

    it('應能建立 Repository', async () => {
      const payload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'test-repository',
      };

      const response = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.repository).toBeDefined();
      expect(response.repository?.id).toBe('test-repository');
      expect(response.repository?.name).toBe('test-repository');
    });

    it('建立重複名稱的 Repository 應回傳錯誤', async () => {
      const payload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'duplicate-repo',
      };

      // 第一次建立
      await emitAndWaitResponse<RepositoryCreatePayload, RepositoryCreatedPayload>(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        payload
      );

      // 第二次建立相同名稱
      const payload2: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'duplicate-repo',
      };

      const response2 = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        payload2
      );

      expect(response2.success).toBe(false);
      expect(response2.error).toBeDefined();
      expect(response2.error).toContain('already exists');
    });

    it('應能建立 Repository Note', async () => {
      // 先建立 Repository
      const repoPayload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'test-repo-for-note',
      };

      const repoResponse = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        repoPayload
      );

      const repositoryId = repoResponse.repository!.id;

      // 建立 Repository Note
      const notePayload: RepositoryNoteCreatePayload = createTestRepositoryNotePayload(
        repositoryId,
        {
          name: 'Test Repository Note',
          x: 400,
          y: 400,
        }
      );

      const noteResponse = await emitAndWaitResponse<
        RepositoryNoteCreatePayload,
        RepositoryNoteCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
        WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
        notePayload
      );

      expect(noteResponse.success).toBe(true);
      expect(noteResponse.note).toBeDefined();
      expect(noteResponse.note?.repositoryId).toBe(repositoryId);
      expect(noteResponse.note?.name).toBe('Test Repository Note');
    });

    it('應能綁定 Repository 到 Pod', async () => {
      // 建立 Pod
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      // 建立 Repository
      const repoPayload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'test-repo-bind',
      };

      const repoResponse = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        repoPayload
      );

      const repositoryId = repoResponse.repository!.id;

      // 綁定 Repository
      const bindPayload: PodBindRepositoryPayload = {
        requestId: uuidv4(),
        podId,
        repositoryId,
      };

      const bindResponse = await emitAndWaitResponse<
        PodBindRepositoryPayload,
        PodRepositoryBoundPayload
      >(
        client,
        WebSocketRequestEvents.POD_BIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        bindPayload
      );

      expect(bindResponse.success).toBe(true);
      expect(bindResponse.pod?.repositoryId).toBe(repositoryId);
    });

    it('應能解除 Pod 的 Repository 綁定', async () => {
      // 建立 Pod 並綁定 Repository
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      const repoPayload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'test-repo-unbind',
      };

      const repoResponse = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        repoPayload
      );

      const repositoryId = repoResponse.repository!.id;

      const bindPayload: PodBindRepositoryPayload = {
        requestId: uuidv4(),
        podId,
        repositoryId,
      };

      await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        bindPayload
      );

      // 解除綁定
      const unbindPayload: PodUnbindRepositoryPayload = {
        requestId: uuidv4(),
        podId,
      };

      const unbindResponse = await emitAndWaitResponse<
        PodUnbindRepositoryPayload,
        PodRepositoryUnboundPayload
      >(
        client,
        WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
        unbindPayload
      );

      expect(unbindResponse.success).toBe(true);
      expect(unbindResponse.pod?.repositoryId).toBeNull();
    });

    it('刪除 Repository 時應檢查是否被使用', async () => {
      // 建立 Pod 並綁定 Repository
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      const repoPayload: RepositoryCreatePayload = {
        requestId: uuidv4(),
        name: 'test-repo-delete',
      };

      const repoResponse = await emitAndWaitResponse<
        RepositoryCreatePayload,
        RepositoryCreatedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_CREATE,
        WebSocketResponseEvents.REPOSITORY_CREATED,
        repoPayload
      );

      const repositoryId = repoResponse.repository!.id;

      const bindPayload: PodBindRepositoryPayload = {
        requestId: uuidv4(),
        podId,
        repositoryId,
      };

      await emitAndWaitResponse<PodBindRepositoryPayload, PodRepositoryBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_REPOSITORY,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        bindPayload
      );

      // 嘗試刪除 Repository
      const deletePayload: RepositoryDeletePayload = {
        requestId: uuidv4(),
        repositoryId,
      };

      const deleteResponse = await emitAndWaitResponse<
        RepositoryDeletePayload,
        RepositoryDeletedPayload
      >(
        client,
        WebSocketRequestEvents.REPOSITORY_DELETE,
        WebSocketResponseEvents.REPOSITORY_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('in use');
    });
  });

  describe('SubAgent 管理', () => {
    it('應能列出可用的 SubAgent', async () => {
      // 建立 Mock SubAgent 檔案
      await fs.mkdir(testConfig.agentsPath, { recursive: true });
      await fs.writeFile(
        path.join(testConfig.agentsPath, 'test-agent.md'),
        '# Test Agent\n\nThis is a test agent.'
      );

      const payload: SubAgentListPayload = { requestId: uuidv4() };
      const response = await emitAndWaitResponse<SubAgentListPayload, SubAgentListResultPayload>(
        client,
        WebSocketRequestEvents.SUBAGENT_LIST,
        WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.subAgents).toBeDefined();
      expect(response.subAgents?.length).toBeGreaterThan(0);
      const testAgent = response.subAgents?.find((s) => s.id === 'test-agent');
      expect(testAgent).toBeDefined();
      expect(testAgent?.name).toBe('test-agent');
    });

    it('應能建立 SubAgent Note', async () => {
      // 建立 Mock SubAgent
      await fs.mkdir(testConfig.agentsPath, { recursive: true });
      await fs.writeFile(path.join(testConfig.agentsPath, 'test-agent.md'), '# Test Agent');

      const payload: SubAgentNoteCreatePayload = createTestSubAgentNotePayload('test-agent', {
        name: 'Test SubAgent Note',
        x: 500,
        y: 500,
      });

      const response = await emitAndWaitResponse<
        SubAgentNoteCreatePayload,
        SubAgentNoteCreatedPayload
      >(
        client,
        WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
        WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
        payload
      );

      expect(response.success).toBe(true);
      expect(response.note).toBeDefined();
      expect(response.note?.subAgentId).toBe('test-agent');
      expect(response.note?.name).toBe('Test SubAgent Note');
    });

    it('應能綁定 SubAgent 到 Pod', async () => {
      // 建立 Pod
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      // 建立 Mock SubAgent
      await fs.mkdir(testConfig.agentsPath, { recursive: true });
      await fs.writeFile(path.join(testConfig.agentsPath, 'test-agent.md'), '# Test Agent');

      // 綁定 SubAgent
      const bindPayload: PodBindSubAgentPayload = {
        requestId: uuidv4(),
        podId,
        subAgentId: 'test-agent',
      };

      const bindResponse = await emitAndWaitResponse<
        PodBindSubAgentPayload,
        PodSubAgentBoundPayload
      >(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        bindPayload
      );

      expect(bindResponse.success).toBe(true);
      expect(bindResponse.pod?.subAgentIds).toContain('test-agent');
    });

    it('重複綁定相同 SubAgent 應回傳錯誤', async () => {
      // 建立 Pod 並綁定 SubAgent
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.agentsPath, { recursive: true });
      await fs.writeFile(path.join(testConfig.agentsPath, 'test-agent.md'), '# Test Agent');

      const bindPayload: PodBindSubAgentPayload = {
        requestId: uuidv4(),
        podId,
        subAgentId: 'test-agent',
      };

      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        bindPayload
      );

      // 再次綁定相同 SubAgent
      const bindPayload2: PodBindSubAgentPayload = {
        requestId: uuidv4(),
        podId,
        subAgentId: 'test-agent',
      };

      const bindResponse2 = await emitAndWaitResponse<
        PodBindSubAgentPayload,
        PodSubAgentBoundPayload
      >(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        bindPayload2
      );

      expect(bindResponse2.success).toBe(false);
      expect(bindResponse2.error).toBeDefined();
      expect(bindResponse2.error).toContain('already bound');
    });

    it('刪除 SubAgent 時應檢查是否被使用', async () => {
      // 建立 Pod 並綁定 SubAgent
      const podPayload: PodCreatePayload = createTestPodPayload();
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );
      const podId = podResponse.pod!.id;

      await fs.mkdir(testConfig.agentsPath, { recursive: true });
      await fs.writeFile(path.join(testConfig.agentsPath, 'test-agent.md'), '# Test Agent');

      const bindPayload: PodBindSubAgentPayload = {
        requestId: uuidv4(),
        podId,
        subAgentId: 'test-agent',
      };

      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        bindPayload
      );

      // 嘗試刪除 SubAgent
      const deletePayload: SubAgentDeletePayload = {
        requestId: uuidv4(),
        subAgentId: 'test-agent',
      };

      const deleteResponse = await emitAndWaitResponse<
        SubAgentDeletePayload,
        SubAgentDeletedPayload
      >(
        client,
        WebSocketRequestEvents.SUBAGENT_DELETE,
        WebSocketResponseEvents.SUBAGENT_DELETED,
        deletePayload
      );

      expect(deleteResponse.success).toBe(false);
      expect(deleteResponse.error).toBeDefined();
      expect(deleteResponse.error).toContain('in use');
    });
  });
});
