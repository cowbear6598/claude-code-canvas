import {v4 as uuidv4} from 'uuid';
import {
    createTestServer,
    closeTestServer,
    createSocketClient,
    emitAndWaitResponse,
    disconnectSocket,
    type TestServerInstance, TestWebSocketClient,
} from '../setup';
import {
    createOutputStyle,
    createSkillFile,
    createRepository,
    createSubAgent,
    createCommand,
    createMcpServer,
    getCanvasId,
} from '../helpers';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type CanvasPastePayload,
    type PastePodItem,
    type PasteConnectionItem,
    type PasteOutputStyleNoteItem,
    type PasteSkillNoteItem,
    type PasteRepositoryNoteItem,
    type PasteSubAgentNoteItem,
    type PasteCommandNoteItem,
    type PasteMcpServerNoteItem,
} from '../../src/schemas';
import { type CanvasPasteResultPayload } from '../../src/types';

describe('貼上功能', () => {
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

    async function emptyPastePayload(): Promise<CanvasPastePayload> {
        const canvasId = await getCanvasId(client);
        return {
            requestId: uuidv4(),
            canvasId,
            pods: [],
            outputStyleNotes: [],
            skillNotes: [],
            repositoryNotes: [],
            subAgentNotes: [],
            commandNotes: [],
            connections: [],
        };
    }

    describe('Canvas 貼上', () => {
        it('成功貼上並建立 Pod 和連線', async () => {
            const podId1 = uuidv4();
            const podId2 = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: podId1, name: 'Paste Pod 1', x: 0, y: 0, rotation: 0},
                {
                    originalId: podId2,
                    name: 'Paste Pod 2',
                    x: 100,
                    y: 100,
                    rotation: 0
                },
            ];

            const connections: PasteConnectionItem[] = [
                {originalSourcePodId: podId1, sourceAnchor: 'right', originalTargetPodId: podId2, targetAnchor: 'left'},
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, connections};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdPods).toHaveLength(2);
            expect(response.createdConnections).toHaveLength(1);
            expect(Object.keys(response.podIdMapping)).toHaveLength(2);
        });

        it('成功貼上並建立綁定 Pod 的註記', async () => {
            const style = await createOutputStyle(client, `paste-style-${uuidv4()}`, '# Style');
            const podId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: podId, name: 'Note Pod', x: 0, y: 0, rotation: 0},
            ];

            const outputStyleNotes: PasteOutputStyleNoteItem[] = [
                {
                    outputStyleId: style.id,
                    name: 'Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: podId,
                    originalPosition: {x: 10, y: 10}
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, outputStyleNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdPods).toHaveLength(1);
            expect(response.createdOutputStyleNotes).toHaveLength(1);

            const newPodId = response.podIdMapping[podId];
            expect(response.createdOutputStyleNotes[0].boundToPodId).toBe(newPodId);
        });

        it('成功貼上空內容', async () => {
            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                await emptyPastePayload()
            );

            expect(response.createdPods).toHaveLength(0);
            expect(response.createdConnections).toHaveLength(0);
        });

        it('成功回報無效項目的錯誤', async () => {
            const validPodId = uuidv4();
            const pods: PastePodItem[] = [
                {originalId: validPodId, name: 'Valid', x: 0, y: 0, rotation: 0},
            ];

            // Connection with nonexistent source should fail silently (no mapping)
            const connections: PasteConnectionItem[] = [
                {
                    originalSourcePodId: uuidv4(),
                    sourceAnchor: 'right',
                    originalTargetPodId: validPodId,
                    targetAnchor: 'left'
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, connections};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdPods).toHaveLength(1);
            // Connection should not be created because source pod is not in the mapping
            expect(response.createdConnections).toHaveLength(0);
        });

        describe('connection triggerMode 驗證', () => {
            const triggerModes = ['auto', 'ai-decide', 'direct'] as const;

            it.each(triggerModes)('貼上 connection 時帶 triggerMode: %s 能成功', async (triggerMode) => {
                const podId1 = uuidv4();
                const podId2 = uuidv4();

                const pods: PastePodItem[] = [
                    {originalId: podId1, name: 'Pod 1', x: 0, y: 0, rotation: 0},
                    {originalId: podId2, name: 'Pod 2', x: 100, y: 100, rotation: 0},
                ];

                const connections: PasteConnectionItem[] = [
                    {
                        originalSourcePodId: podId1,
                        sourceAnchor: 'right',
                        originalTargetPodId: podId2,
                        targetAnchor: 'left',
                        triggerMode,
                    },
                ];

                const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, connections};

                const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                    client,
                    WebSocketRequestEvents.CANVAS_PASTE,
                    WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                    payload
                );

                expect(response.createdConnections).toHaveLength(1);
            });

            it('貼上 connection 時不帶 triggerMode 能成功', async () => {
                const podId1 = uuidv4();
                const podId2 = uuidv4();

                const pods: PastePodItem[] = [
                    {originalId: podId1, name: 'Pod 1', x: 0, y: 0, rotation: 0},
                    {originalId: podId2, name: 'Pod 2', x: 100, y: 100, rotation: 0},
                ];

                const connections: PasteConnectionItem[] = [
                    {
                        originalSourcePodId: podId1,
                        sourceAnchor: 'right',
                        originalTargetPodId: podId2,
                        targetAnchor: 'left',
                    },
                ];

                const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, connections};

                const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                    client,
                    WebSocketRequestEvents.CANVAS_PASTE,
                    WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                    payload
                );

                expect(response.createdConnections).toHaveLength(1);
            });
        });

        it('成功貼上並建立技能註記', async () => {
            const skillId = await createSkillFile(`skill-${uuidv4()}`, '# Test Skill');

            const skillNotes: PasteSkillNoteItem[] = [
                {
                    skillId,
                    name: 'Skill Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: null,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), skillNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdSkillNotes).toHaveLength(1);
            expect(response.createdSkillNotes[0].skillId).toBe(skillId);
        });

        it('成功貼上並建立儲存庫註記', async () => {
            const repository = await createRepository(client, `repo-${uuidv4()}`);

            const repositoryNotes: PasteRepositoryNoteItem[] = [
                {
                    repositoryId: repository.id,
                    name: 'Repository Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: null,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), repositoryNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdRepositoryNotes).toHaveLength(1);
            expect(response.createdRepositoryNotes[0].repositoryId).toBe(repository.id);
        });

        it('成功貼上並建立子代理註記', async () => {
            const subAgent = await createSubAgent(client, `subagent-${uuidv4()}`, '# Test SubAgent');

            const subAgentNotes: PasteSubAgentNoteItem[] = [
                {
                    subAgentId: subAgent.id,
                    name: 'SubAgent Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: null,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), subAgentNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdSubAgentNotes).toHaveLength(1);
            expect(response.createdSubAgentNotes[0].subAgentId).toBe(subAgent.id);
        });

        it('成功貼上並建立綁定 Pod 的指令註記', async () => {
            const command = await createCommand(client, `command-${uuidv4()}`, '# Test Command');
            const originalPodId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'Command Pod', x: 0, y: 0, rotation: 0},
            ];

            const commandNotes: PasteCommandNoteItem[] = [
                {
                    commandId: command.id,
                    name: 'Command Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: originalPodId,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, commandNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdCommandNotes).toHaveLength(1);
            expect(response.createdPods).toHaveLength(1);

            const newPodId = response.podIdMapping[originalPodId];
            expect(response.createdCommandNotes[0].boundToPodId).toBe(newPodId);

            const canvasId = await getCanvasId(client);
            const {podStore} = await import('../../src/services/podStore.js');
            const pod = podStore.getById(canvasId, newPodId);
            expect(pod?.commandId).toBe(command.id);
        });

        it('成功貼上並建立綁定 Pod 的 MCP server 註記，且 Pod 的 mcpServerIds 被更新', async () => {
            const mcpServer = await createMcpServer(client, `mcp-${uuidv4()}`);
            const originalPodId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'MCP Pod', x: 0, y: 0, rotation: 0},
            ];

            const mcpServerNotes: PasteMcpServerNoteItem[] = [
                {
                    mcpServerId: mcpServer.id,
                    name: 'MCP Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: originalPodId,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods, mcpServerNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdMcpServerNotes).toHaveLength(1);
            expect(response.createdPods).toHaveLength(1);

            const newPodId = response.podIdMapping[originalPodId];
            expect(response.createdMcpServerNotes[0].boundToPodId).toBe(newPodId);

            const canvasId = await getCanvasId(client);
            const {podStore} = await import('../../src/services/podStore.js');
            const pod = podStore.getById(canvasId, newPodId);
            expect(pod?.mcpServerIds).toContain(mcpServer.id);
        });

        it('Command Note 未綁定 Pod 時可獨立貼上，且不建立任何 Pod', async () => {
            const command = await createCommand(client, `command-unbound-${uuidv4()}`, '# Test Command');

            const commandNotes: PasteCommandNoteItem[] = [
                {
                    commandId: command.id,
                    name: 'Unbound Command Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: null,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), commandNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdCommandNotes).toHaveLength(1);
            expect(response.createdCommandNotes[0].boundToPodId).toBeNull();
            expect(response.createdPods).toHaveLength(0);
        });

        it('貼上 Command Note 時，若 Pod 已有 commandId，不覆蓋原本的 commandId', async () => {
            const command1 = await createCommand(client, `command-existing-${uuidv4()}`, '# Existing Command');
            const command2 = await createCommand(client, `command-new-${uuidv4()}`, '# New Command');
            const originalPodId = uuidv4();

            // 先貼上一個 Pod，並綁定 command1
            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'Command Pod', x: 0, y: 0, rotation: 0},
            ];
            const firstCommandNotes: PasteCommandNoteItem[] = [
                {
                    commandId: command1.id,
                    name: 'Command Note 1',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: originalPodId,
                    originalPosition: {x: 10, y: 10},
                },
            ];
            const firstPayload: CanvasPastePayload = {...await emptyPastePayload(), pods, commandNotes: firstCommandNotes};
            const firstResponse = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                firstPayload
            );

            const newPodId = firstResponse.podIdMapping[originalPodId];
            const canvasId = await getCanvasId(client);
            const {podStore} = await import('../../src/services/podStore.js');

            const podAfterFirst = podStore.getById(canvasId, newPodId);
            expect(podAfterFirst?.commandId).toBe(command1.id);

            // 再貼上一個 commandNote（綁定到已建立的 Pod），commandId 為 command2
            // Pod 已有 commandId（command1），不應被覆蓋
            const secondCommandNotes: PasteCommandNoteItem[] = [
                {
                    commandId: command2.id,
                    name: 'Command Note 2',
                    x: 20,
                    y: 20,
                    boundToOriginalPodId: newPodId,
                    originalPosition: {x: 20, y: 20},
                },
            ];
            const secondPayload: CanvasPastePayload = {
                ...await emptyPastePayload(),
                commandNotes: secondCommandNotes,
            };

            await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                secondPayload
            );

            const podAfterSecond = podStore.getById(canvasId, newPodId);
            expect(podAfterSecond?.commandId).toBe(command1.id);
        });

        it('Pod 的 repositoryId 指向不存在的 UUID 時，回報錯誤且不建立該 Pod', async () => {
            const nonExistentRepositoryId = uuidv4();
            const originalPodId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'Invalid Repo Pod', x: 0, y: 0, rotation: 0, repositoryId: nonExistentRepositoryId},
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), pods};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.success).toBe(false);
            expect(response.errors).toHaveLength(1);
            expect(response.createdPods).not.toContainEqual(
                expect.objectContaining({id: originalPodId})
            );
        });

        it('MCP Server Note 未綁定 Pod 時可獨立貼上，且不影響任何 Pod 的 mcpServerIds', async () => {
            const mcpServer = await createMcpServer(client, `mcp-unbound-${uuidv4()}`);

            const mcpServerNotes: PasteMcpServerNoteItem[] = [
                {
                    mcpServerId: mcpServer.id,
                    name: 'Unbound MCP Note',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: null,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            const payload: CanvasPastePayload = {...await emptyPastePayload(), mcpServerNotes};

            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                payload
            );

            expect(response.createdMcpServerNotes).toHaveLength(1);
            expect(response.createdMcpServerNotes[0].mcpServerId).toBe(mcpServer.id);
            expect(response.createdMcpServerNotes[0].boundToPodId).toBeNull();
            expect(response.createdPods).toHaveLength(0);
        });

        it('貼上 MCP Server Note 時，若 Pod 的 mcpServerIds 已包含該 mcpServerId，不應重複加入', async () => {
            const mcpServer = await createMcpServer(client, `mcp-dedup-${uuidv4()}`);
            const originalPodId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'MCP Dedup Pod', x: 0, y: 0, rotation: 0},
            ];

            const mcpServerNotes: PasteMcpServerNoteItem[] = [
                {
                    mcpServerId: mcpServer.id,
                    name: 'MCP Note Dedup',
                    x: 10,
                    y: 10,
                    boundToOriginalPodId: originalPodId,
                    originalPosition: {x: 10, y: 10},
                },
            ];

            // 先貼上一次，建立 Pod 並綁定 mcpServerId
            const firstPayload: CanvasPastePayload = {...await emptyPastePayload(), pods, mcpServerNotes};
            const firstResponse = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                firstPayload
            );

            const newPodId = firstResponse.podIdMapping[originalPodId];
            const canvasId = await getCanvasId(client);
            const {podStore} = await import('../../src/services/podStore.js');

            const podAfterFirst = podStore.getById(canvasId, newPodId);
            expect(podAfterFirst?.mcpServerIds).toContain(mcpServer.id);
            const countAfterFirst = podAfterFirst?.mcpServerIds.length ?? 0;

            // 再次貼上同一個 mcpServerId，boundToOriginalPodId 直接指向已建立的 Pod
            // 此 Pod 的 mcpServerIds 已包含該 mcpServerId，應不重複加入
            const secondMcpServerNotes: PasteMcpServerNoteItem[] = [
                {
                    mcpServerId: mcpServer.id,
                    name: 'MCP Note Dedup 2',
                    x: 20,
                    y: 20,
                    boundToOriginalPodId: newPodId,
                    originalPosition: {x: 20, y: 20},
                },
            ];

            const secondPayload: CanvasPastePayload = {
                ...await emptyPastePayload(),
                mcpServerNotes: secondMcpServerNotes,
            };

            await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                secondPayload
            );

            const podAfterSecond = podStore.getById(canvasId, newPodId);
            expect(podAfterSecond?.mcpServerIds.length).toBe(countAfterFirst);
            expect(podAfterSecond?.mcpServerIds.filter(id => id === mcpServer.id)).toHaveLength(1);
        });
    });
});
