import type { Socket } from 'socket.io';
import { podStore } from '../services/podStore.js';
import { WebSocketResponseEvents } from '../types/index.js';
import type { PodSetAutoClearPayload } from '../schemas/index.js';

export const handlePodSetAutoClear = async (
  socket: Socket,
  payload: PodSetAutoClearPayload,
  requestId: string
): Promise<void> => {
  const { podId, autoClear } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    socket.emit(WebSocketResponseEvents.POD_AUTO_CLEAR_SET, {
      requestId,
      success: false,
      error: `Pod ${podId} not found`,
    });
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
