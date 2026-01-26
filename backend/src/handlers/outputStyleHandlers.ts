import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type OutputStyleListResultPayload,
  type PodOutputStyleBoundPayload,
  type PodOutputStyleUnboundPayload,
} from '../types/index.js';
import type {
  OutputStyleListPayload,
  PodBindOutputStylePayload,
  PodUnbindOutputStylePayload,
} from '../schemas/index.js';
import { outputStyleService } from '../services/outputStyleService.js';
import { podStore } from '../services/podStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';

export async function handleOutputStyleList(
  socket: Socket,
  _: OutputStyleListPayload,
  requestId: string
): Promise<void> {
  const styles = await outputStyleService.listStyles();

  const response: OutputStyleListResultPayload = {
    requestId,
    success: true,
    styles,
  };

  emitSuccess(socket, WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, response);

  console.log(`[OutputStyle] Listed ${styles.length} output styles`);
}

export async function handlePodBindOutputStyle(
  socket: Socket,
  payload: PodBindOutputStylePayload,
  requestId: string
): Promise<void> {
  const { podId, outputStyleId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    console.error(`[OutputStyle] Failed to bind style: Pod not found: ${podId}`);
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

    console.error(`[OutputStyle] Failed to bind style: Output style not found: ${outputStyleId}`);
    return;
  }

  podStore.setOutputStyleId(podId, outputStyleId);

  const updatedPod = podStore.getById(podId);

  const response: PodOutputStyleBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, response);

  console.log(`[OutputStyle] Bound style ${outputStyleId} to Pod ${podId}`);
}

export async function handlePodUnbindOutputStyle(
  socket: Socket,
  payload: PodUnbindOutputStylePayload,
  requestId: string
): Promise<void> {
  const { podId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    console.error(`[OutputStyle] Failed to unbind style: Pod not found: ${podId}`);
    return;
  }

  podStore.setOutputStyleId(podId, null);

  const updatedPod = podStore.getById(podId);

  const response: PodOutputStyleUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, response);

  console.log(`[OutputStyle] Unbound style from Pod ${podId}`);
}
