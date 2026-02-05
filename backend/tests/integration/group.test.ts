import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createCommand, createOutputStyle, createSubAgent } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type GroupCreatePayload,
  type GroupListPayload,
  type GroupUpdatePayload,
  type GroupDeletePayload,
  type CommandMoveToGroupPayload,
  type OutputStyleMoveToGroupPayload,
  type SubAgentMoveToGroupPayload,
} from '../../src/schemas/index.js';
import {
  type Group,
  type GroupCreatedResponse,
  type GroupListResultResponse,
  type GroupUpdatedResponse,
  type GroupDeletedResponse,
  type ItemMovedToGroupResponse,
} from '../../src/types/index.js';

describe('Group 管理', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  async function createGroup(type: 'command' | 'output-style' | 'subagent', name?: string) {
    const groupName = name ?? `group-${uuidv4().slice(0, 8)}`;
    const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
      client,
      WebSocketRequestEvents.GROUP_CREATE,
      WebSocketResponseEvents.GROUP_CREATED,
      { requestId: uuidv4(), name: groupName, type }
    );
    return response;
  }

  describe('建立 Group', () => {
    it('success_when_create_command_group', async () => {
      const response = await createGroup('command');

      expect(response.success).toBe(true);
      expect(response.group).toBeDefined();
      expect(response.group!.type).toBe('command');
    });

    it('success_when_create_output_style_group', async () => {
      const response = await createGroup('output-style');

      expect(response.success).toBe(true);
      expect(response.group).toBeDefined();
      expect(response.group!.type).toBe('output-style');
    });

    it('success_when_create_subagent_group', async () => {
      const response = await createGroup('subagent');

      expect(response.success).toBe(true);
      expect(response.group).toBeDefined();
      expect(response.group!.type).toBe('subagent');
    });

    it('failed_when_create_group_with_duplicate_name', async () => {
      const groupName = `dup-group-${uuidv4().slice(0, 8)}`;
      await createGroup('command', groupName);

      const response = await createGroup('command', groupName);

      expect(response.success).toBe(false);
      expect(response.error).toContain('已存在');
    });

    it('failed_when_create_group_with_path_traversal', async () => {
      const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_CREATE,
        WebSocketResponseEvents.GROUP_CREATED,
        { requestId: uuidv4(), name: '../malicious', type: 'command' }
      );

      expect(response.success).toBe(false);
    });

    it('failed_when_create_group_with_slash', async () => {
      const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_CREATE,
        WebSocketResponseEvents.GROUP_CREATED,
        { requestId: uuidv4(), name: 'test/path', type: 'command' }
      );

      expect(response.success).toBe(false);
    });

    it('failed_when_create_group_with_special_chars', async () => {
      const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_CREATE,
        WebSocketResponseEvents.GROUP_CREATED,
        { requestId: uuidv4(), name: 'test@group', type: 'command' }
      );

      expect(response.success).toBe(false);
    });

    it('success_when_create_group_with_dash', async () => {
      const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_CREATE,
        WebSocketResponseEvents.GROUP_CREATED,
        { requestId: uuidv4(), name: 'test-group-123', type: 'command' }
      );

      expect(response.success).toBe(true);
      expect(response.group).toBeDefined();
    });
  });

  describe('列出 Groups', () => {
    it('success_when_list_command_groups', async () => {
      const group = await createGroup('command');

      const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
        client,
        WebSocketRequestEvents.GROUP_LIST,
        WebSocketResponseEvents.GROUP_LIST_RESULT,
        { requestId: uuidv4(), type: 'command' }
      );

      expect(response.success).toBe(true);
      expect(response.groups).toBeDefined();
      expect(response.groups!.length).toBeGreaterThan(0);
      expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
    });

    it('success_when_list_output_style_groups', async () => {
      const group = await createGroup('output-style');

      const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
        client,
        WebSocketRequestEvents.GROUP_LIST,
        WebSocketResponseEvents.GROUP_LIST_RESULT,
        { requestId: uuidv4(), type: 'output-style' }
      );

      expect(response.success).toBe(true);
      expect(response.groups).toBeDefined();
      expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
    });

    it('success_when_list_subagent_groups', async () => {
      const group = await createGroup('subagent');

      const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
        client,
        WebSocketRequestEvents.GROUP_LIST,
        WebSocketResponseEvents.GROUP_LIST_RESULT,
        { requestId: uuidv4(), type: 'subagent' }
      );

      expect(response.success).toBe(true);
      expect(response.groups).toBeDefined();
      expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
    });
  });

  describe('更新 Group', () => {
    it('success_when_rename_group', async () => {
      const group = await createGroup('command');
      const newName = `renamed-${uuidv4().slice(0, 8)}`;

      const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_UPDATE,
        WebSocketResponseEvents.GROUP_UPDATED,
        { requestId: uuidv4(), groupId: group.group!.id, name: newName }
      );

      expect(response.success).toBe(true);
      expect(response.group).toBeDefined();
      expect(response.group!.name).toBe(newName);
      expect(response.group!.id).toBe(newName);
    });

    it('failed_when_rename_nonexistent_group', async () => {
      const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_UPDATE,
        WebSocketResponseEvents.GROUP_UPDATED,
        { requestId: uuidv4(), groupId: 'nonexistent-group', name: 'new-name' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('不存在');
    });

    it('failed_when_rename_to_existing_name', async () => {
      const group1 = await createGroup('command');
      const group2 = await createGroup('command');

      const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_UPDATE,
        WebSocketResponseEvents.GROUP_UPDATED,
        { requestId: uuidv4(), groupId: group1.group!.id, name: group2.group!.name }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('已存在');
    });

    it('failed_when_rename_with_path_traversal', async () => {
      const group = await createGroup('command');

      const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
        client,
        WebSocketRequestEvents.GROUP_UPDATE,
        WebSocketResponseEvents.GROUP_UPDATED,
        { requestId: uuidv4(), groupId: group.group!.id, name: '../evil' }
      );

      expect(response.success).toBe(false);
    });
  });

  describe('刪除 Group', () => {
    it('success_when_delete_empty_group', async () => {
      const group = await createGroup('command');

      const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
        client,
        WebSocketRequestEvents.GROUP_DELETE,
        WebSocketResponseEvents.GROUP_DELETED,
        { requestId: uuidv4(), groupId: group.group!.id }
      );

      expect(response.success).toBe(true);
      expect(response.groupId).toBe(group.group!.id);
    });

    it('failed_when_delete_group_with_items', async () => {
      const group = await createGroup('command');
      const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

      await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: group.group!.id }
      );

      const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
        client,
        WebSocketRequestEvents.GROUP_DELETE,
        WebSocketResponseEvents.GROUP_DELETED,
        { requestId: uuidv4(), groupId: group.group!.id }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('還有項目');
    });

    it('failed_when_delete_nonexistent_group', async () => {
      const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
        client,
        WebSocketRequestEvents.GROUP_DELETE,
        WebSocketResponseEvents.GROUP_DELETED,
        { requestId: uuidv4(), groupId: 'nonexistent-group' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('不存在');
    });
  });

  describe('Command 移動到 Group', () => {
    it('success_when_move_command_to_group', async () => {
      const group = await createGroup('command');
      const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

      const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: group.group!.id }
      );

      expect(response.success).toBe(true);
      expect(response.itemId).toBe(command.id);
      expect(response.groupId).toBe(group.group!.id);
    });

    it('success_when_move_command_from_group_to_root', async () => {
      const group = await createGroup('command');
      const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

      await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: group.group!.id }
      );

      const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: null }
      );

      expect(response.success).toBe(true);
      expect(response.groupId).toBeNull();
    });

    it('success_when_move_command_between_groups', async () => {
      const group1 = await createGroup('command');
      const group2 = await createGroup('command');
      const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

      await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: group1.group!.id }
      );

      const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
        WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: command.id, groupId: group2.group!.id }
      );

      expect(response.success).toBe(true);
      expect(response.groupId).toBe(group2.group!.id);
    });
  });

  describe('Output Style 移動到 Group', () => {
    it('success_when_move_output_style_to_group', async () => {
      const group = await createGroup('output-style');
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Style');

      const response = await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
        WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: style.id, groupId: group.group!.id }
      );

      expect(response.success).toBe(true);
      expect(response.itemId).toBe(style.id);
      expect(response.groupId).toBe(group.group!.id);
    });

    it('success_when_move_output_style_from_group_to_root', async () => {
      const group = await createGroup('output-style');
      const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Style');

      await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
        WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: style.id, groupId: group.group!.id }
      );

      const response = await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
        WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: style.id, groupId: null }
      );

      expect(response.success).toBe(true);
      expect(response.groupId).toBeNull();
    });
  });

  describe('SubAgent 移動到 Group', () => {
    it('success_when_move_subagent_to_group', async () => {
      const group = await createGroup('subagent');
      const agent = await createSubAgent(client, `agent-${uuidv4()}`, '# Agent');

      const response = await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
        WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: agent.id, groupId: group.group!.id }
      );

      expect(response.success).toBe(true);
      expect(response.itemId).toBe(agent.id);
      expect(response.groupId).toBe(group.group!.id);
    });

    it('success_when_move_subagent_from_group_to_root', async () => {
      const group = await createGroup('subagent');
      const agent = await createSubAgent(client, `agent-${uuidv4()}`, '# Agent');

      await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
        WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: agent.id, groupId: group.group!.id }
      );

      const response = await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
        client,
        WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
        WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
        { requestId: uuidv4(), itemId: agent.id, groupId: null }
      );

      expect(response.success).toBe(true);
      expect(response.groupId).toBeNull();
    });
  });
});
