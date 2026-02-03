import type {Socket} from 'socket.io';
import {podStore} from '../services/podStore.js';
import {socketService} from '../services/socketService.js';
import {WebSocketResponseEvents, type BroadcastPodAutoClearSetPayload} from '../types/index.js';
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

        socket.emit(WebSocketResponseEvents.POD_AUTO_CLEAR_SET, {
            requestId,
            success: true,
            pod: updatedPod,
        });

        const broadcastPayload: BroadcastPodAutoClearSetPayload = {
            canvasId,
            pod: updatedPod!,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_AUTO_CLEAR_SET, broadcastPayload);
    }
);
