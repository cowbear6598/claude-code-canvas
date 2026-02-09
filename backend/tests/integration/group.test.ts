import {v4 as uuidv4} from 'uuid';
import {
    closeTestServer,
    createSocketClient,
    createTestServer,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance, TestWebSocketClient,
} from '../setup';
import {createCommand, createOutputStyle, createSubAgent} from '../helpers';
import {
    type CommandMoveToGroupPayload,
    type GroupCreatePayload,
    type GroupDeletePayload,
    type GroupListPayload,
    type GroupUpdatePayload,
    type OutputStyleMoveToGroupPayload,
    type SubAgentMoveToGroupPayload,
    WebSocketRequestEvents,
    WebSocketResponseEvents,
} from '../../src/schemas';
import {
    type Group,
    type GroupCreatedResponse,
    type GroupDeletedResponse,
    type GroupListResultResponse,
    type GroupUpdatedResponse,
    type ItemMovedToGroupResponse,
} from '../../src/types';

describe('Group 管理', () => {
    let server: TestServerInstance;
    let client: TestWebSocketClient;

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

        return await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
            client,
            WebSocketRequestEvents.GROUP_CREATE,
            WebSocketResponseEvents.GROUP_CREATED,
            {requestId: uuidv4(), name: groupName, type}
        );
    }

    describe('建立 Group', () => {
        it('成功建立 Command 群組', async () => {
            const response = await createGroup('command');

            expect(response.success).toBe(true);
            expect(response.group).toBeDefined();
            expect(response.group!.type).toBe('command');
        });

        it('成功建立 Output Style 群組', async () => {
            const response = await createGroup('output-style');

            expect(response.success).toBe(true);
            expect(response.group).toBeDefined();
            expect(response.group!.type).toBe('output-style');
        });

        it('成功建立 SubAgent 群組', async () => {
            const response = await createGroup('subagent');

            expect(response.success).toBe(true);
            expect(response.group).toBeDefined();
            expect(response.group!.type).toBe('subagent');
        });

        it('重複名稱時建立群組失敗', async () => {
            const groupName = `dup-group-${uuidv4().slice(0, 8)}`;
            await createGroup('command', groupName);

            const response = await createGroup('command', groupName);

            expect(response.success).toBe(false);
            expect(response.error).toContain('已存在');
        });

        it('路徑穿越攻擊時建立群組失敗', async () => {
            const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_CREATE,
                WebSocketResponseEvents.GROUP_CREATED,
                {requestId: uuidv4(), name: '../malicious', type: 'command'}
            );

            expect(response.success).toBe(false);
        });

        it('包含斜線時建立群組失敗', async () => {
            const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_CREATE,
                WebSocketResponseEvents.GROUP_CREATED,
                {requestId: uuidv4(), name: 'test/path', type: 'command'}
            );

            expect(response.success).toBe(false);
        });

        it('包含特殊字元時建立群組失敗', async () => {
            const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_CREATE,
                WebSocketResponseEvents.GROUP_CREATED,
                {requestId: uuidv4(), name: 'test@group', type: 'command'}
            );

            expect(response.success).toBe(false);
        });

        it('成功建立包含破折號的群組', async () => {
            const response = await emitAndWaitResponse<GroupCreatePayload, GroupCreatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_CREATE,
                WebSocketResponseEvents.GROUP_CREATED,
                {requestId: uuidv4(), name: 'test-group-123', type: 'command'}
            );

            expect(response.success).toBe(true);
            expect(response.group).toBeDefined();
        });
    });

    describe('列出 Groups', () => {
        it('成功列出 Command 群組', async () => {
            const group = await createGroup('command');

            const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
                client,
                WebSocketRequestEvents.GROUP_LIST,
                WebSocketResponseEvents.GROUP_LIST_RESULT,
                {requestId: uuidv4(), type: 'command'}
            );

            expect(response.success).toBe(true);
            expect(response.groups).toBeDefined();
            expect(response.groups!.length).toBeGreaterThan(0);
            expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
        });

        it('成功列出 Output Style 群組', async () => {
            const group = await createGroup('output-style');

            const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
                client,
                WebSocketRequestEvents.GROUP_LIST,
                WebSocketResponseEvents.GROUP_LIST_RESULT,
                {requestId: uuidv4(), type: 'output-style'}
            );

            expect(response.success).toBe(true);
            expect(response.groups).toBeDefined();
            expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
        });

        it('成功列出 SubAgent 群組', async () => {
            const group = await createGroup('subagent');

            const response = await emitAndWaitResponse<GroupListPayload, GroupListResultResponse>(
                client,
                WebSocketRequestEvents.GROUP_LIST,
                WebSocketResponseEvents.GROUP_LIST_RESULT,
                {requestId: uuidv4(), type: 'subagent'}
            );

            expect(response.success).toBe(true);
            expect(response.groups).toBeDefined();
            expect(response.groups!.some((g: Group) => g.id === group.group!.id)).toBe(true);
        });
    });

    describe('更新 Group', () => {
        it('成功重新命名群組', async () => {
            const group = await createGroup('command');
            const newName = `renamed-${uuidv4().slice(0, 8)}`;

            const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_UPDATE,
                WebSocketResponseEvents.GROUP_UPDATED,
                {requestId: uuidv4(), groupId: group.group!.id, name: newName}
            );

            expect(response.success).toBe(true);
            expect(response.group).toBeDefined();
            expect(response.group!.name).toBe(newName);
            expect(response.group!.id).toBe(newName);
        });

        it('不存在的群組時重新命名失敗', async () => {
            const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_UPDATE,
                WebSocketResponseEvents.GROUP_UPDATED,
                {requestId: uuidv4(), groupId: 'nonexistent-group', name: 'new-name'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('不存在');
        });

        it('重新命名為已存在名稱時失敗', async () => {
            const group1 = await createGroup('command');
            const group2 = await createGroup('command');

            const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_UPDATE,
                WebSocketResponseEvents.GROUP_UPDATED,
                {requestId: uuidv4(), groupId: group1.group!.id, name: group2.group!.name}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('已存在');
        });

        it('路徑穿越攻擊時重新命名失敗', async () => {
            const group = await createGroup('command');

            const response = await emitAndWaitResponse<GroupUpdatePayload, GroupUpdatedResponse>(
                client,
                WebSocketRequestEvents.GROUP_UPDATE,
                WebSocketResponseEvents.GROUP_UPDATED,
                {requestId: uuidv4(), groupId: group.group!.id, name: '../evil'}
            );

            expect(response.success).toBe(false);
        });
    });

    describe('刪除 Group', () => {
        it('成功刪除空群組', async () => {
            const group = await createGroup('command');

            const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
                client,
                WebSocketRequestEvents.GROUP_DELETE,
                WebSocketResponseEvents.GROUP_DELETED,
                {requestId: uuidv4(), groupId: group.group!.id}
            );

            expect(response.success).toBe(true);
            expect(response.groupId).toBe(group.group!.id);
        });

        it('群組內有項目時刪除失敗', async () => {
            const group = await createGroup('command');
            const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

            await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: group.group!.id}
            );

            const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
                client,
                WebSocketRequestEvents.GROUP_DELETE,
                WebSocketResponseEvents.GROUP_DELETED,
                {requestId: uuidv4(), groupId: group.group!.id}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('還有項目');
        });

        it('不存在的群組時刪除失敗', async () => {
            const response = await emitAndWaitResponse<GroupDeletePayload, GroupDeletedResponse>(
                client,
                WebSocketRequestEvents.GROUP_DELETE,
                WebSocketResponseEvents.GROUP_DELETED,
                {requestId: uuidv4(), groupId: 'nonexistent-group'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('不存在');
        });
    });

    describe('Command 移動到 Group', () => {
        it('成功將 Command 移至群組', async () => {
            const group = await createGroup('command');
            const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

            const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: group.group!.id}
            );

            expect(response.success).toBe(true);
            expect(response.itemId).toBe(command.id);
            expect(response.groupId).toBe(group.group!.id);
        });

        it('成功將 Command 從群組移至根目錄', async () => {
            const group = await createGroup('command');
            const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

            await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: group.group!.id}
            );

            const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: null}
            );

            expect(response.success).toBe(true);
            expect(response.groupId).toBeNull();
        });

        it('成功在群組間移動 Command', async () => {
            const group1 = await createGroup('command');
            const group2 = await createGroup('command');
            const command = await createCommand(client, `cmd-${uuidv4()}`, '# Content');

            await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: group1.group!.id}
            );

            const response = await emitAndWaitResponse<CommandMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
                WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: command.id, groupId: group2.group!.id}
            );

            expect(response.success).toBe(true);
            expect(response.groupId).toBe(group2.group!.id);
        });
    });

    describe('Output Style 移動到 Group', () => {
        it('成功將 Output Style 移至群組', async () => {
            const group = await createGroup('output-style');
            const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Style');

            const response = await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
                WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: style.id, groupId: group.group!.id}
            );

            expect(response.success).toBe(true);
            expect(response.itemId).toBe(style.id);
            expect(response.groupId).toBe(group.group!.id);
        });

        it('成功將 Output Style 從群組移至根目錄', async () => {
            const group = await createGroup('output-style');
            const style = await createOutputStyle(client, `style-${uuidv4()}`, '# Style');

            await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
                WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: style.id, groupId: group.group!.id}
            );

            const response = await emitAndWaitResponse<OutputStyleMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.OUTPUT_STYLE_MOVE_TO_GROUP,
                WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: style.id, groupId: null}
            );

            expect(response.success).toBe(true);
            expect(response.groupId).toBeNull();
        });
    });

    describe('SubAgent 移動到 Group', () => {
        it('成功將 SubAgent 移至群組', async () => {
            const group = await createGroup('subagent');
            const agent = await createSubAgent(client, `agent-${uuidv4()}`, '# Agent');

            const response = await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
                WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: agent.id, groupId: group.group!.id}
            );

            expect(response.success).toBe(true);
            expect(response.itemId).toBe(agent.id);
            expect(response.groupId).toBe(group.group!.id);
        });

        it('成功將 SubAgent 從群組移至根目錄', async () => {
            const group = await createGroup('subagent');
            const agent = await createSubAgent(client, `agent-${uuidv4()}`, '# Agent');

            await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
                WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: agent.id, groupId: group.group!.id}
            );

            const response = await emitAndWaitResponse<SubAgentMoveToGroupPayload, ItemMovedToGroupResponse>(
                client,
                WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
                WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
                {requestId: uuidv4(), itemId: agent.id, groupId: null}
            );

            expect(response.success).toBe(true);
            expect(response.groupId).toBeNull();
        });
    });
});
