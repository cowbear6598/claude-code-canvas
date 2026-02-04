import type {Socket} from 'socket.io';
import {podStore} from '../services/podStore.js';
import {socketService} from '../services/socketService.js';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {PodAutoClearSetPayload} from '../types/index.js';
import type {PodSetAutoClearPayload} from '../schemas/index.js';
import {validatePod, withCanvasId} from '../utils/handlerHelpers.js';

export const handlePodSetAutoClear = withCanvasId<PodSetAutoClearPayload>(
    WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
    async (socket: Socket, canvasId: string, payload: PodSetAutoClearPayload, requestId: string): Promise<void> => {
        const {podId, autoClear} = payload;

        const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_AUTO_CLEAR_SET, requestId);

        if (!pod) {
            return;
        }

        podStore.setAutoClear(canvasId, podId, autoClear);

        const updatedPod = podStore.getById(canvasId, podId);

        const response: PodAutoClearSetPayload = {
            requestId,
            canvasId,
            success: true,
            pod: updatedPod,
        };
        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_AUTO_CLEAR_SET, response);
    }
);
