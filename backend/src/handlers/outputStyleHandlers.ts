import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type OutputStyleListPayload,
  type OutputStyleListResultPayload,
  type PodBindOutputStylePayload,
  type PodOutputStyleBoundPayload,
  type PodUnbindOutputStylePayload,
  type PodOutputStyleUnboundPayload,
} from '../types/index.js';
import { outputStyleService } from '../services/outputStyleService.js';
import { podStore } from '../services/podStore.js';
import {
  emitSuccess,
  emitError,
  tryValidatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

export async function handleOutputStyleList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<OutputStyleListPayload>(payload, ['requestId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
      validation.error!,
      requestId,
      undefined,
      'VALIDATION_ERROR'
    );

    console.error(`[OutputStyle] Failed to list styles: ${validation.error}`);
    return;
  }

  const { requestId } = validation.data!;

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
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<PodBindOutputStylePayload>(payload, [
    'requestId',
    'podId',
    'outputStyleId',
  ]);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    const podId =
      typeof payload === 'object' && payload && 'podId' in payload
        ? (payload.podId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      validation.error!,
      requestId,
      podId,
      'VALIDATION_ERROR'
    );

    console.error(`[OutputStyle] Failed to bind style: ${validation.error}`);
    return;
  }

  const { requestId, podId, outputStyleId } = validation.data!;

  // Check if Pod exists
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

  // Check if style exists
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
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<PodUnbindOutputStylePayload>(payload, ['requestId', 'podId']);

  if (!validation.success) {
    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    const podId =
      typeof payload === 'object' && payload && 'podId' in payload
        ? (payload.podId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
      validation.error!,
      requestId,
      podId,
      'VALIDATION_ERROR'
    );

    console.error(`[OutputStyle] Failed to unbind style: ${validation.error}`);
    return;
  }

  const { requestId, podId } = validation.data!;

  // Check if Pod exists
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
