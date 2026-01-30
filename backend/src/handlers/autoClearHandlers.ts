import type {Socket} from 'socket.io';
import {podStore} from '../services/podStore.js';
import {WebSocketResponseEvents} from '../types/index.js';
import type {PodSetAutoClearPayload} from '../schemas/index.js';
import {validatePod} from '../utils/handlerHelpers.js';

export const handlePodSetAutoClear = async (
    socket: Socket,
    payload: PodSetAutoClearPayload,
    requestId: string
): Promise<void> => {
    const {podId, autoClear} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_AUTO_CLEAR_SET, requestId);

    if (!pod) {
        return;
    }

    podStore.setAutoClear(podId, autoClear);

    const updatedPod = podStore.getById(podId);

    socket.emit(WebSocketResponseEvents.POD_AUTO_CLEAR_SET, {
        requestId,
        success: true,
        pod: updatedPod,
    });
};
