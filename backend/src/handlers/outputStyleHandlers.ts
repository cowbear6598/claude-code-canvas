import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  OutputStyleListResultPayload,
  PodOutputStyleBoundPayload,
  PodOutputStyleUnboundPayload,
} from '../types/index.js';
import type {
  OutputStyleListPayload,
  PodBindOutputStylePayload,
  PodUnbindOutputStylePayload,
  OutputStyleDeletePayload,
  OutputStyleMoveToGroupPayload,
} from '../schemas/index.js';
import { outputStyleService } from '../services/outputStyleService.js';
import { podStore } from '../services/podStore.js';
import { noteStore } from '../services/noteStores.js';
import { socketService } from '../services/socketService.js';
import { emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { validatePod, handleResourceDelete, withCanvasId } from '../utils/handlerHelpers.js';
import { createResourceHandlers } from './factories/createResourceHandlers.js';
import { createMoveToGroupHandler } from './factories/createMoveToGroupHandler.js';
import { GroupType } from '../types/index.js';

const resourceHandlers = createResourceHandlers({
  service: outputStyleService,
  events: {
    listResult: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    created: WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    updated: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
    readResult: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
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

  socket.emit(WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, response);
}

export const handlePodBindOutputStyle = withCanvasId<PodBindOutputStylePayload>(
  WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
  async (socket: Socket, canvasId: string, payload: PodBindOutputStylePayload, requestId: string): Promise<void> => {
    const { podId, outputStyleId } = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, requestId);
    if (!pod) {
      return;
    }

  const styleExists = await outputStyleService.exists(outputStyleId);
  if (!styleExists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
      `Output style 找不到: ${outputStyleId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );

    return;
  }

  podStore.setOutputStyleId(canvasId, podId, outputStyleId);

  const updatedPod = podStore.getById(canvasId, podId);
  if (!updatedPod) {
    logger.error('OutputStyle', 'Bind', `無法取得更新後的 Pod: ${podId}`);
    return;
  }

  const response: PodOutputStyleBoundPayload = {
    requestId,
    canvasId,
    success: true,
    pod: updatedPod,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, response);

  logger.log('OutputStyle', 'Bind', `Bound style ${outputStyleId} to Pod ${podId}`);
  }
);

export const handlePodUnbindOutputStyle = withCanvasId<PodUnbindOutputStylePayload>(
  WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
  async (socket: Socket, canvasId: string, payload: PodUnbindOutputStylePayload, requestId: string): Promise<void> => {
    const { podId } = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, requestId);
    if (!pod) {
      return;
    }

  podStore.setOutputStyleId(canvasId, podId, null);

  const updatedPod = podStore.getById(canvasId, podId);
  if (!updatedPod) {
    logger.error('OutputStyle', 'Unbind', `無法取得更新後的 Pod: ${podId}`);
    return;
  }

  const response: PodOutputStyleUnboundPayload = {
    requestId,
    canvasId,
    success: true,
    pod: updatedPod,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, response);

  logger.log('OutputStyle', 'Unbind', `Unbound style from Pod ${podId}`);
  }
);

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
    existsCheck: () => outputStyleService.exists(outputStyleId),
    findPodsUsing: (canvasId: string) => podStore.findByOutputStyleId(canvasId, outputStyleId),
    deleteNotes: (canvasId: string) => noteStore.deleteByForeignKey(canvasId, outputStyleId),
    deleteResource: () => outputStyleService.delete(outputStyleId),
    idFieldName: 'outputStyleId',
  });
}

const outputStyleMoveToGroupHandler = createMoveToGroupHandler({
  service: outputStyleService,
  resourceName: 'OutputStyle',
  idField: 'itemId',
  groupType: GroupType.OUTPUT_STYLE,
  events: {
    moved: WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
  },
});

export async function handleOutputStyleMoveToGroup(
  socket: Socket,
  payload: OutputStyleMoveToGroupPayload,
  requestId: string
): Promise<void> {
  return outputStyleMoveToGroupHandler(socket, payload, requestId);
}
