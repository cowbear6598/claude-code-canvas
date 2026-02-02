import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type OutputStyleListResultPayload,
  type PodOutputStyleBoundPayload,
  type PodOutputStyleUnboundPayload,
  type BroadcastPodOutputStyleBoundPayload,
  type BroadcastPodOutputStyleUnboundPayload,
} from '../types/index.js';
import type {
  OutputStyleListPayload,
  PodBindOutputStylePayload,
  PodUnbindOutputStylePayload,
  OutputStyleDeletePayload,
} from '../schemas/index.js';
import { outputStyleService } from '../services/outputStyleService.js';
import { podStore } from '../services/podStore.js';
import { noteStore } from '../services/noteStores.js';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { validatePod, handleResourceDelete, getCanvasId } from '../utils/handlerHelpers.js';
import { createResourceHandlers } from './factories/createResourceHandlers.js';

const resourceHandlers = createResourceHandlers({
  service: outputStyleService,
  events: {
    listResult: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    created: WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    updated: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
    readResult: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
  },
  broadcastEvents: {
    created: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_CREATED,
    updated: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_UPDATED,
  },
  resourceName: 'OutputStyle',
  responseKey: 'outputStyle',
  idField: 'outputStyleId',
});

export const handleOutputStyleCreate = resourceHandlers.handleCreate;
export const handleOutputStyleUpdate = resourceHandlers.handleUpdate;
export const handleOutputStyleRead = resourceHandlers.handleRead!;

export async function handleOutputStyleList(
  socket: Socket,
  _: OutputStyleListPayload,
  requestId: string
): Promise<void> {
  const styles = await outputStyleService.list();

  const response: OutputStyleListResultPayload = {
    requestId,
    success: true,
    styles,
  };

  emitSuccess(socket, WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, response);
}

export async function handlePodBindOutputStyle(
  socket: Socket,
  payload: PodBindOutputStylePayload,
  requestId: string
): Promise<void> {
  const { podId, outputStyleId } = payload;

  const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, requestId);
  if (!pod) {
    return;
  }

  const canvasId = getCanvasId(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, requestId);
  if (!canvasId) {
    return;
  }

  const styleExists = await outputStyleService.exists(outputStyleId);
  if (!styleExists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      `Output style not found: ${outputStyleId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    return;
  }

  podStore.setOutputStyleId(canvasId, podId, outputStyleId);

  const updatedPod = podStore.getById(canvasId, podId);

  const response: PodOutputStyleBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, response);

  const broadcastPayload: BroadcastPodOutputStyleBoundPayload = {
    canvasId,
    pod: updatedPod!,
  };
  socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_BOUND, broadcastPayload);

  logger.log('OutputStyle', 'Bind', `Bound style ${outputStyleId} to Pod ${podId}`);
}

export async function handlePodUnbindOutputStyle(
  socket: Socket,
  payload: PodUnbindOutputStylePayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, requestId);
  if (!pod) {
    return;
  }

  const canvasId = getCanvasId(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, requestId);
  if (!canvasId) {
    return;
  }

  podStore.setOutputStyleId(canvasId, podId, null);

  const updatedPod = podStore.getById(canvasId, podId);

  const response: PodOutputStyleUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, response);

  const broadcastPayload: BroadcastPodOutputStyleUnboundPayload = {
    canvasId,
    pod: updatedPod!,
  };
  socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_UNBOUND, broadcastPayload);

  logger.log('OutputStyle', 'Unbind', `Unbound style from Pod ${podId}`);
}

export async function handleOutputStyleDelete(
  socket: Socket,
  payload: OutputStyleDeletePayload,
  requestId: string
): Promise<void> {
  const { outputStyleId } = payload;

  await handleResourceDelete({
    socket,
    requestId,
    resourceId: outputStyleId,
    resourceName: 'OutputStyle',
    responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
    broadcastEvent: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_DELETED,
    existsCheck: () => outputStyleService.exists(outputStyleId),
    findPodsUsing: (canvasId: string) => podStore.findByOutputStyleId(canvasId, outputStyleId),
    deleteNotes: (canvasId: string) => noteStore.deleteByForeignKey(canvasId, outputStyleId),
    deleteResource: () => outputStyleService.delete(outputStyleId),
  });
}
