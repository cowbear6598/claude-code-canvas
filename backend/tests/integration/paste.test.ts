import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import type {Socket} from 'socket.io-client';
import {v4 as uuidv4} from 'uuid';
import {
    createTestServer,
    closeTestServer,
    createSocketClient,
    emitAndWaitResponse,
    disconnectSocket,
    type TestServerInstance,
} from '../setup/index.js';
import {createOutputStyle} from '../helpers/index.js';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type CanvasPastePayload,
    type CanvasPasteResultPayload,
    type PastePodItem,
    type PasteConnectionItem,
    type PasteOutputStyleNoteItem,
} from '../../src/types/index.js';

describe('paste', () => {
    let server: TestServerInstance;
    let client: Socket;

    beforeAll(async () => {
        server = await createTestServer();
        client = await createSocketClient(server.baseUrl);
    });

    afterAll(async () => {
        if (client?.connected) await disconnectSocket(client);
        if (server) await closeTestServer(server);
    });

    function emptyPastePayload(): CanvasPastePayload {
        return {
            requestId: uuidv4(),
            pods: [],
            outputStyleNotes: [],
            skillNotes: [],
            repositoryNotes: [],
            subAgentNotes: [],
            commandNotes: [],
            connections: [],
        };
    }

    describe('handleCanvasPaste', () => {
        it('success_when_paste_creates_pods_and_connections', async () => {
            const podId1 = uuidv4();
            const podId2 = uuidv4();

            const pods: PastePodItem[] = [
                {originalId: podId1, name: 'Paste Pod 1', type: 'General AI', color: 'blue', x: 0, y: 0, rotation: 0},
                {
                    originalId: podId2,
                    name: 'Paste Pod 2',
                    type: 'General AI',
                    color: 'blue',
                    x: 100,
                    y: 100,
                    rotation: 0
                },
            ];

            const connections: PasteConnectionItem[] = [
                {originalSourcePodId: podId1, sourceAnchor: 'right', originalTargetPodId: podId2, targetAnchor: 'left'},
            ];

            const payload: CanvasPastePayload = {...emptyPastePayload(), pods, connections};

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
                {originalId: podId, name: 'Note Pod', type: 'General AI', color: 'blue', x: 0, y: 0, rotation: 0},
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

            const payload: CanvasPastePayload = {...emptyPastePayload(), pods, outputStyleNotes};

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
                emptyPastePayload()
            );

            expect(response.createdPods).toHaveLength(0);
            expect(response.createdConnections).toHaveLength(0);
        });

        it('success_when_paste_reports_errors_for_invalid_items', async () => {
            const validPodId = uuidv4();
            const pods: PastePodItem[] = [
                {originalId: validPodId, name: 'Valid', type: 'General AI', color: 'blue', x: 0, y: 0, rotation: 0},
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

            const payload: CanvasPastePayload = {...emptyPastePayload(), pods, connections};

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
    });
});
