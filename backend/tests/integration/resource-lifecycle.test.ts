// 資源完整生命週期測試
// 測試 5 種資源（Skill, Command, SubAgent, OutputStyle, Repository）的完整 CRUD + Note + 綁定/解綁/刪除流程

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
  createTestSkillNotePayload,
  createTestRepositoryNotePayload,
  createTestSubAgentNotePayload,
  createTestOutputStyleNotePayload,
} from '../fixtures/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodDeletePayload,
  type PodDeletedPayload,
  type PodGetPayload,
  type PodGetResultPayload,
  type SkillListPayload,
  type SkillListResultPayload,
  type SkillNoteCreatePayload,
  type SkillNoteCreatedPayload,
  type SkillNoteListPayload,
  type SkillNoteListResultPayload,
  type SkillNoteUpdatePayload,
  type SkillNoteUpdatedPayload,
  type PodBindSkillPayload,
  type PodSkillBoundPayload,
  type SkillDeletePayload,
  type SkillDeletedPayload,
  type CommandListPayload,
  type CommandListResultPayload,
  type CommandNoteCreatePayload,
  type CommandNoteCreatedPayload,
  type PodBindCommandPayload,
  type PodCommandBoundPayload,
  type PodUnbindCommandPayload,
  type PodCommandUnboundPayload,
  type CommandDeletePayload,
  type CommandDeletedPayload,
  type SubAgentListPayload,
  type SubAgentListResultPayload,
  type SubAgentNoteCreatePayload,
  type SubAgentNoteCreatedPayload,
  type PodBindSubAgentPayload,
  type PodSubAgentBoundPayload,
  type SubAgentDeletePayload,
  type SubAgentDeletedPayload,
  type OutputStyleListPayload,
  type OutputStyleListResultPayload,
  type NoteCreatePayload,
  type NoteCreatedPayload,
  type PodBindOutputStylePayload,
  type PodOutputStyleBoundPayload,
  type PodUnbindOutputStylePayload,
  type PodOutputStyleUnboundPayload,
  type OutputStyleDeletePayload,
  type OutputStyleDeletedPayload,
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
} from '../../src/types/index.js';

describe('資源完整生命週期', () => {
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

  it('Skill 完整流程', async () => {
    // 建立 Mock Skill
    await fs.mkdir(testConfig.skillsPath, { recursive: true });
    const testSkillDir = path.join(testConfig.skillsPath, 'test-skill-lifecycle');
    await fs.mkdir(testSkillDir, { recursive: true });
    await fs.writeFile(path.join(testSkillDir, 'SKILL.md'), '# Test Skill Lifecycle');

    // 列出 Skill
    const listPayload: SkillListPayload = { requestId: uuidv4() };
    const listResponse = await emitAndWaitResponse<SkillListPayload, SkillListResultPayload>(
      client,
      WebSocketRequestEvents.SKILL_LIST,
      WebSocketResponseEvents.SKILL_LIST_RESULT,
      listPayload
    );

    expect(listResponse.success).toBe(true);
    expect(listResponse.skills).toBeDefined();
    const skill = listResponse.skills!.find((s) => s.id === 'test-skill-lifecycle');
    expect(skill).toBeDefined();

    // 建立 Skill Note
    const notePayload: SkillNoteCreatePayload = createTestSkillNotePayload('test-skill-lifecycle', {
      name: 'Test Skill Note',
    });

    const noteResponse = await emitAndWaitResponse<
      SkillNoteCreatePayload,
      SkillNoteCreatedPayload
    >(
      client,
      WebSocketRequestEvents.SKILL_NOTE_CREATE,
      WebSocketResponseEvents.SKILL_NOTE_CREATED,
      notePayload
    );

    expect(noteResponse.success).toBe(true);
    expect(noteResponse.note).toBeDefined();
    const noteId = noteResponse.note!.id;

    // 列出 Skill Notes
    const noteListPayload: SkillNoteListPayload = { requestId: uuidv4() };
    const noteListResponse = await emitAndWaitResponse<
      SkillNoteListPayload,
      SkillNoteListResultPayload
    >(
      client,
      WebSocketRequestEvents.SKILL_NOTE_LIST,
      WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
      noteListPayload
    );

    expect(noteListResponse.success).toBe(true);
    expect(noteListResponse.notes).toBeDefined();
    const foundNote = noteListResponse.notes!.find((n) => n.id === noteId);
    expect(foundNote).toBeDefined();

    // 更新 Skill Note (只能更新位置，不能更新 name)
    const updatePayload: SkillNoteUpdatePayload = {
      requestId: uuidv4(),
      noteId,
      x: 300,
      y: 400,
    };

    const updateResponse = await emitAndWaitResponse<
      SkillNoteUpdatePayload,
      SkillNoteUpdatedPayload
    >(
      client,
      WebSocketRequestEvents.SKILL_NOTE_UPDATE,
      WebSocketResponseEvents.SKILL_NOTE_UPDATED,
      updatePayload
    );

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.note?.x).toBe(300);
    expect(updateResponse.note?.y).toBe(400);

    // 建立 Pod 並綁定 Skill
    const podPayload: PodCreatePayload = createTestPodPayload({ name: 'Skill Test Pod' });
    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    const podId = podResponse.pod!.id;

    const bindPayload: PodBindSkillPayload = {
      requestId: uuidv4(),
      podId,
      skillId: 'test-skill-lifecycle',
    };

    const bindResponse = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
      client,
      WebSocketRequestEvents.POD_BIND_SKILL,
      WebSocketResponseEvents.POD_SKILL_BOUND,
      bindPayload
    );

    expect(bindResponse.success).toBe(true);
    expect(bindResponse.pod?.skillIds).toContain('test-skill-lifecycle');

    // 嘗試刪除 Skill（失敗，因為 in use）
    const deletePayload: SkillDeletePayload = {
      requestId: uuidv4(),
      skillId: 'test-skill-lifecycle',
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

    // 刪除 Pod
    const deletePodPayload: PodDeletePayload = { requestId: uuidv4(), podId };
    const deletePodResponse = await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
      client,
      WebSocketRequestEvents.POD_DELETE,
      WebSocketResponseEvents.POD_DELETED,
      deletePodPayload
    );

    expect(deletePodResponse.success).toBe(true);

    // 再次刪除 Skill（成功）
    const deletePayload2: SkillDeletePayload = {
      requestId: uuidv4(),
      skillId: 'test-skill-lifecycle',
    };

    const deleteResponse2 = await emitAndWaitResponse<SkillDeletePayload, SkillDeletedPayload>(
      client,
      WebSocketRequestEvents.SKILL_DELETE,
      WebSocketResponseEvents.SKILL_DELETED,
      deletePayload2
    );

    expect(deleteResponse2.success).toBe(true);

    // 驗證 Skill Note 也被刪除
    const noteListPayload2: SkillNoteListPayload = { requestId: uuidv4() };
    const noteListResponse2 = await emitAndWaitResponse<
      SkillNoteListPayload,
      SkillNoteListResultPayload
    >(
      client,
      WebSocketRequestEvents.SKILL_NOTE_LIST,
      WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
      noteListPayload2
    );

    expect(noteListResponse2.success).toBe(true);
    const deletedNote = noteListResponse2.notes!.find((n) => n.id === noteId);
    expect(deletedNote).toBeUndefined();
  });

  it('Command 完整流程', async () => {
    // 建立 Mock Command (單檔案結構)
    await fs.mkdir(testConfig.commandsPath, { recursive: true });
    await fs.writeFile(
      path.join(testConfig.commandsPath, 'test-command-lifecycle.md'),
      '# Test Command Lifecycle'
    );

    // 列出 Command
    const listPayload: CommandListPayload = { requestId: uuidv4() };
    const listResponse = await emitAndWaitResponse<CommandListPayload, CommandListResultPayload>(
      client,
      WebSocketRequestEvents.COMMAND_LIST,
      WebSocketResponseEvents.COMMAND_LIST_RESULT,
      listPayload
    );

    expect(listResponse.success).toBe(true);
    expect(listResponse.commands).toBeDefined();
    const command = listResponse.commands!.find((c) => c.id === 'test-command-lifecycle');
    expect(command).toBeDefined();

    // 建立 Command Note
    const notePayload: CommandNoteCreatePayload = {
      requestId: uuidv4(),
      commandId: 'test-command-lifecycle',
      name: 'Test Command Note',
      x: 200,
      y: 200,
      boundToPodId: null,
      originalPosition: null,
    };

    const noteResponse = await emitAndWaitResponse<
      CommandNoteCreatePayload,
      CommandNoteCreatedPayload
    >(
      client,
      WebSocketRequestEvents.COMMAND_NOTE_CREATE,
      WebSocketResponseEvents.COMMAND_NOTE_CREATED,
      notePayload
    );

    expect(noteResponse.success).toBe(true);
    expect(noteResponse.note).toBeDefined();

    // 建立 Pod 並綁定 Command
    const podPayload: PodCreatePayload = createTestPodPayload({ name: 'Command Test Pod' });
    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    const podId = podResponse.pod!.id;

    const bindPayload: PodBindCommandPayload = {
      requestId: uuidv4(),
      podId,
      commandId: 'test-command-lifecycle',
    };

    const bindResponse = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
      client,
      WebSocketRequestEvents.POD_BIND_COMMAND,
      WebSocketResponseEvents.POD_COMMAND_BOUND,
      bindPayload
    );

    expect(bindResponse.success).toBe(true);
    expect(bindResponse.pod?.commandId).toBe('test-command-lifecycle');

    // 驗證 commandId
    const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.pod?.commandId).toBe('test-command-lifecycle');

    // 解綁 Command
    const unbindPayload: PodUnbindCommandPayload = {
      requestId: uuidv4(),
      podId,
    };

    const unbindResponse = await emitAndWaitResponse<
      PodUnbindCommandPayload,
      PodCommandUnboundPayload
    >(
      client,
      WebSocketRequestEvents.POD_UNBIND_COMMAND,
      WebSocketResponseEvents.POD_COMMAND_UNBOUND,
      unbindPayload
    );

    expect(unbindResponse.success).toBe(true);
    expect(unbindResponse.pod?.commandId).toBeNull();

    // 驗證 commandId 為 null
    const getPayload2: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse2 = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload2
    );

    expect(getResponse2.success).toBe(true);
    expect(getResponse2.pod?.commandId).toBeNull();

    // 再次綁定
    const bindPayload2: PodBindCommandPayload = {
      requestId: uuidv4(),
      podId,
      commandId: 'test-command-lifecycle',
    };

    const bindResponse2 = await emitAndWaitResponse<PodBindCommandPayload, PodCommandBoundPayload>(
      client,
      WebSocketRequestEvents.POD_BIND_COMMAND,
      WebSocketResponseEvents.POD_COMMAND_BOUND,
      bindPayload2
    );

    expect(bindResponse2.success).toBe(true);
    expect(bindResponse2.pod?.commandId).toBe('test-command-lifecycle');

    // 嘗試刪除 Command（失敗）
    const deletePayload: CommandDeletePayload = {
      requestId: uuidv4(),
      commandId: 'test-command-lifecycle',
    };

    const deleteResponse = await emitAndWaitResponse<CommandDeletePayload, CommandDeletedPayload>(
      client,
      WebSocketRequestEvents.COMMAND_DELETE,
      WebSocketResponseEvents.COMMAND_DELETED,
      deletePayload
    );

    expect(deleteResponse.success).toBe(false);
    expect(deleteResponse.error).toBeDefined();
    expect(deleteResponse.error).toContain('in use');

    // 解綁 Command
    const unbindPayload2: PodUnbindCommandPayload = {
      requestId: uuidv4(),
      podId,
    };

    await emitAndWaitResponse<PodUnbindCommandPayload, PodCommandUnboundPayload>(
      client,
      WebSocketRequestEvents.POD_UNBIND_COMMAND,
      WebSocketResponseEvents.POD_COMMAND_UNBOUND,
      unbindPayload2
    );

    // 刪除 Command（成功）
    const deletePayload2: CommandDeletePayload = {
      requestId: uuidv4(),
      commandId: 'test-command-lifecycle',
    };

    const deleteResponse2 = await emitAndWaitResponse<CommandDeletePayload, CommandDeletedPayload>(
      client,
      WebSocketRequestEvents.COMMAND_DELETE,
      WebSocketResponseEvents.COMMAND_DELETED,
      deletePayload2
    );

    expect(deleteResponse2.success).toBe(true);

    // 驗證 Note 刪除
    const noteListPayload: any = { requestId: uuidv4() };
    const noteListResponse: any = await emitAndWaitResponse(
      client,
      WebSocketRequestEvents.COMMAND_NOTE_LIST,
      WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT,
      noteListPayload
    );

    expect(noteListResponse.success).toBe(true);
    const deletedNote = noteListResponse.notes!.find(
      (n: any) => n.commandId === 'test-command-lifecycle'
    );
    expect(deletedNote).toBeUndefined();
  });

  it('SubAgent 完整流程', async () => {
    // 建立 Mock SubAgent
    await fs.mkdir(testConfig.agentsPath, { recursive: true });
    await fs.writeFile(
      path.join(testConfig.agentsPath, 'test-agent-lifecycle.md'),
      '# Test SubAgent Lifecycle'
    );

    // 列出 SubAgent
    const listPayload: SubAgentListPayload = { requestId: uuidv4() };
    const listResponse = await emitAndWaitResponse<SubAgentListPayload, SubAgentListResultPayload>(
      client,
      WebSocketRequestEvents.SUBAGENT_LIST,
      WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
      listPayload
    );

    expect(listResponse.success).toBe(true);
    expect(listResponse.subAgents).toBeDefined();
    const agent = listResponse.subAgents!.find((a) => a.id === 'test-agent-lifecycle');
    expect(agent).toBeDefined();

    // 建立 SubAgent Note
    const notePayload: SubAgentNoteCreatePayload = createTestSubAgentNotePayload(
      'test-agent-lifecycle',
      { name: 'Test SubAgent Note' }
    );

    const noteResponse = await emitAndWaitResponse<
      SubAgentNoteCreatePayload,
      SubAgentNoteCreatedPayload
    >(
      client,
      WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
      notePayload
    );

    expect(noteResponse.success).toBe(true);
    expect(noteResponse.note).toBeDefined();

    // 建立 Pod 並綁定 SubAgent
    const podPayload: PodCreatePayload = createTestPodPayload({ name: 'SubAgent Test Pod' });
    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    const podId = podResponse.pod!.id;

    const bindPayload: PodBindSubAgentPayload = {
      requestId: uuidv4(),
      podId,
      subAgentId: 'test-agent-lifecycle',
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
    expect(bindResponse.pod?.subAgentIds).toContain('test-agent-lifecycle');

    // 驗證 subAgentIds
    const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.pod?.subAgentIds).toContain('test-agent-lifecycle');

    // 嘗試刪除 SubAgent（失敗）
    const deletePayload: SubAgentDeletePayload = {
      requestId: uuidv4(),
      subAgentId: 'test-agent-lifecycle',
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

    // 刪除 Pod
    const deletePodPayload: PodDeletePayload = { requestId: uuidv4(), podId };
    await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
      client,
      WebSocketRequestEvents.POD_DELETE,
      WebSocketResponseEvents.POD_DELETED,
      deletePodPayload
    );

    // 再次刪除 SubAgent（成功）
    const deletePayload2: SubAgentDeletePayload = {
      requestId: uuidv4(),
      subAgentId: 'test-agent-lifecycle',
    };

    const deleteResponse2 = await emitAndWaitResponse<
      SubAgentDeletePayload,
      SubAgentDeletedPayload
    >(
      client,
      WebSocketRequestEvents.SUBAGENT_DELETE,
      WebSocketResponseEvents.SUBAGENT_DELETED,
      deletePayload2
    );

    expect(deleteResponse2.success).toBe(true);

    // 驗證 Note 刪除
    const noteListPayload: any = { requestId: uuidv4() };
    const noteListResponse: any = await emitAndWaitResponse(
      client,
      WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
      WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
      noteListPayload
    );

    expect(noteListResponse.success).toBe(true);
    const deletedNote = noteListResponse.notes!.find(
      (n: any) => n.subAgentId === 'test-agent-lifecycle'
    );
    expect(deletedNote).toBeUndefined();
  });

  it('OutputStyle 完整流程', async () => {
    // 建立 Mock OutputStyle
    await fs.mkdir(testConfig.outputStylesPath, { recursive: true });
    await fs.writeFile(
      path.join(testConfig.outputStylesPath, 'test-style-lifecycle.md'),
      '# Test OutputStyle Lifecycle'
    );

    // 列出 OutputStyle
    const listPayload: OutputStyleListPayload = { requestId: uuidv4() };
    const listResponse = await emitAndWaitResponse<
      OutputStyleListPayload,
      OutputStyleListResultPayload
    >(
      client,
      WebSocketRequestEvents.OUTPUT_STYLE_LIST,
      WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
      listPayload
    );

    expect(listResponse.success).toBe(true);
    expect(listResponse.styles).toBeDefined();
    const style = listResponse.styles!.find((s) => s.id === 'test-style-lifecycle');
    expect(style).toBeDefined();

    // 建立 OutputStyle Note
    const notePayload: NoteCreatePayload = createTestOutputStyleNotePayload(
      'test-style-lifecycle',
      { name: 'Test OutputStyle Note' }
    );

    const noteResponse = await emitAndWaitResponse<NoteCreatePayload, NoteCreatedPayload>(
      client,
      WebSocketRequestEvents.NOTE_CREATE,
      WebSocketResponseEvents.NOTE_CREATED,
      notePayload
    );

    expect(noteResponse.success).toBe(true);
    expect(noteResponse.note).toBeDefined();

    // 建立 Pod 並綁定 OutputStyle
    const podPayload: PodCreatePayload = createTestPodPayload({ name: 'OutputStyle Test Pod' });
    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    const podId = podResponse.pod!.id;

    const bindPayload: PodBindOutputStylePayload = {
      requestId: uuidv4(),
      podId,
      outputStyleId: 'test-style-lifecycle',
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
    expect(bindResponse.pod?.outputStyleId).toBe('test-style-lifecycle');

    // 解綁 OutputStyle
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

    // 驗證 null
    const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.pod?.outputStyleId).toBeNull();

    // 再次綁定
    const bindPayload2: PodBindOutputStylePayload = {
      requestId: uuidv4(),
      podId,
      outputStyleId: 'test-style-lifecycle',
    };

    const bindResponse2 = await emitAndWaitResponse<
      PodBindOutputStylePayload,
      PodOutputStyleBoundPayload
    >(
      client,
      WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      bindPayload2
    );

    expect(bindResponse2.success).toBe(true);
    expect(bindResponse2.pod?.outputStyleId).toBe('test-style-lifecycle');

    // 嘗試刪除 OutputStyle（失敗）
    const deletePayload: OutputStyleDeletePayload = {
      requestId: uuidv4(),
      outputStyleId: 'test-style-lifecycle',
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

    // 解綁 OutputStyle
    const unbindPayload2: PodUnbindOutputStylePayload = {
      requestId: uuidv4(),
      podId,
    };

    await emitAndWaitResponse<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>(
      client,
      WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
      unbindPayload2
    );

    // 刪除 OutputStyle（成功）
    const deletePayload2: OutputStyleDeletePayload = {
      requestId: uuidv4(),
      outputStyleId: 'test-style-lifecycle',
    };

    const deleteResponse2 = await emitAndWaitResponse<
      OutputStyleDeletePayload,
      OutputStyleDeletedPayload
    >(
      client,
      WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
      WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
      deletePayload2
    );

    expect(deleteResponse2.success).toBe(true);

    // 驗證 Note 刪除
    const noteListPayload: any = { requestId: uuidv4() };
    const noteListResponse: any = await emitAndWaitResponse(
      client,
      WebSocketRequestEvents.NOTE_LIST,
      WebSocketResponseEvents.NOTE_LIST_RESULT,
      noteListPayload
    );

    expect(noteListResponse.success).toBe(true);
    const deletedNote = noteListResponse.notes!.find(
      (n: any) => n.outputStyleId === 'test-style-lifecycle'
    );
    expect(deletedNote).toBeUndefined();
  });

  it('Repository 完整流程', async () => {
    // 建立 Repository
    const createPayload: RepositoryCreatePayload = {
      requestId: uuidv4(),
      name: 'test-repo-lifecycle',
    };

    const createResponse = await emitAndWaitResponse<
      RepositoryCreatePayload,
      RepositoryCreatedPayload
    >(
      client,
      WebSocketRequestEvents.REPOSITORY_CREATE,
      WebSocketResponseEvents.REPOSITORY_CREATED,
      createPayload
    );

    expect(createResponse.success).toBe(true);
    expect(createResponse.repository).toBeDefined();
    const repositoryId = createResponse.repository!.id;

    // 列出 Repository
    const listPayload: RepositoryListPayload = { requestId: uuidv4() };
    const listResponse = await emitAndWaitResponse<
      RepositoryListPayload,
      RepositoryListResultPayload
    >(
      client,
      WebSocketRequestEvents.REPOSITORY_LIST,
      WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
      listPayload
    );

    expect(listResponse.success).toBe(true);
    expect(listResponse.repositories).toBeDefined();
    const repo = listResponse.repositories!.find((r) => r.id === repositoryId);
    expect(repo).toBeDefined();

    // 建立 Repository Note
    const notePayload: RepositoryNoteCreatePayload = createTestRepositoryNotePayload(repositoryId, {
      name: 'Test Repository Note',
    });

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

    // 建立 Pod 並綁定 Repository
    const podPayload: PodCreatePayload = createTestPodPayload({ name: 'Repository Test Pod' });
    const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
      client,
      WebSocketRequestEvents.POD_CREATE,
      WebSocketResponseEvents.POD_CREATED,
      podPayload
    );

    expect(podResponse.success).toBe(true);
    const podId = podResponse.pod!.id;

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

    // 解綁 Repository
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

    // 驗證 null
    const getPayload: PodGetPayload = { requestId: uuidv4(), podId };
    const getResponse = await emitAndWaitResponse<PodGetPayload, PodGetResultPayload>(
      client,
      WebSocketRequestEvents.POD_GET,
      WebSocketResponseEvents.POD_GET_RESULT,
      getPayload
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.pod?.repositoryId).toBeNull();

    // 再次綁定
    const bindPayload2: PodBindRepositoryPayload = {
      requestId: uuidv4(),
      podId,
      repositoryId,
    };

    const bindResponse2 = await emitAndWaitResponse<
      PodBindRepositoryPayload,
      PodRepositoryBoundPayload
    >(
      client,
      WebSocketRequestEvents.POD_BIND_REPOSITORY,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND,
      bindPayload2
    );

    expect(bindResponse2.success).toBe(true);
    expect(bindResponse2.pod?.repositoryId).toBe(repositoryId);

    // 嘗試刪除 Repository（失敗）
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

    // 解綁 Repository
    const unbindPayload2: PodUnbindRepositoryPayload = {
      requestId: uuidv4(),
      podId,
    };

    await emitAndWaitResponse<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>(
      client,
      WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
      WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
      unbindPayload2
    );

    // 刪除 Repository（成功）
    const deletePayload2: RepositoryDeletePayload = {
      requestId: uuidv4(),
      repositoryId,
    };

    const deleteResponse2 = await emitAndWaitResponse<
      RepositoryDeletePayload,
      RepositoryDeletedPayload
    >(
      client,
      WebSocketRequestEvents.REPOSITORY_DELETE,
      WebSocketResponseEvents.REPOSITORY_DELETED,
      deletePayload2
    );

    expect(deleteResponse2.success).toBe(true);

    // 驗證 Note 刪除
    const noteListPayload: any = { requestId: uuidv4() };
    const noteListResponse: any = await emitAndWaitResponse(
      client,
      WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
      WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
      noteListPayload
    );

    expect(noteListResponse.success).toBe(true);
    const deletedNote = noteListResponse.notes!.find((n: any) => n.repositoryId === repositoryId);
    expect(deletedNote).toBeUndefined();
  });
});
