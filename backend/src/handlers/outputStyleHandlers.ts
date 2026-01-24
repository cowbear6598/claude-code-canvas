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
  validatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

export async function handleOutputStyleList(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<OutputStyleListPayload>(payload, ['requestId']);

    const { requestId } = payload;

    const styles = await outputStyleService.listStyles();

    const response: OutputStyleListResultPayload = {
      requestId,
      success: true,
      styles,
    };

    emitSuccess(socket, WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, response);

    console.log(`[OutputStyle] Listed ${styles.length} output styles`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const requestId =
      typeof payload === 'object' && payload && 'requestId' in payload
        ? (payload.requestId as string)
        : undefined;

    emitError(
      socket,
      WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
      errorMessage,
      requestId,
      undefined,
      errorCode
    );

    console.error(`[OutputStyle] Failed to list styles: ${errorMessage}`);
  }
}

export async function handlePodBindOutputStyle(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<PodBindOutputStylePayload>(payload, [
      'requestId',
      'podId',
      'outputStyleId',
    ]);

    const { requestId, podId, outputStyleId } = payload;

    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    const styleExists = await outputStyleService.exists(outputStyleId);
    if (!styleExists) {
      throw new Error(`Output style not found: ${outputStyleId}`);
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
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

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
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[OutputStyle] Failed to bind style: ${errorMessage}`);
  }
}

export async function handlePodUnbindOutputStyle(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<PodUnbindOutputStylePayload>(payload, ['requestId', 'podId']);

    const { requestId, podId } = payload;

    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
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
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

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
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[OutputStyle] Failed to unbind style: ${errorMessage}`);
  }
}
