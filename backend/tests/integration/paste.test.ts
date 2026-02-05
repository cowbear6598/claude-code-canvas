import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
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
        it('success_when_paste_creates_pods_and_connections', async () => {
            const podId1 = uuidv4();
            const podId2 = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: podId1, name: 'Paste Pod 1', color: 'blue', x: 0, y: 0, rotation: 0},
                {
                    originalId: podId2,
                    name: 'Paste Pod 2',
                    color: 'blue',
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

        it('success_when_paste_creates_notes_with_pod_binding', async () => {
            const style = await createOutputStyle(client, `paste-style-${uuidv4()}`, '# Style');
            const podId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: podId, name: 'Note Pod', color: 'blue', x: 0, y: 0, rotation: 0},
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

        it('success_when_paste_with_empty_payload', async () => {
            const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_PASTE,
                WebSocketResponseEvents.CANVAS_PASTE_RESULT,
                await emptyPastePayload()
            );

            expect(response.createdPods).toHaveLength(0);
            expect(response.createdConnections).toHaveLength(0);
        });

        it('success_when_paste_reports_errors_for_invalid_items', async () => {
            const validPodId = uuidv4();
            const pods: PastePodItem[] = [
                {originalId: validPodId, name: 'Valid', color: 'blue', x: 0, y: 0, rotation: 0},
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

        it('success_when_paste_creates_skill_notes', async () => {
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

        it('success_when_paste_creates_repository_notes', async () => {
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

        it('success_when_paste_creates_subagent_notes', async () => {
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

        it('success_when_paste_creates_command_notes_and_binds_to_pods', async () => {
            const command = await createCommand(client, `command-${uuidv4()}`, '# Test Command');
            const originalPodId = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: originalPodId, name: 'Command Pod', color: 'blue', x: 0, y: 0, rotation: 0},
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
    });
});
