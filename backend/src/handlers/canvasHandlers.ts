import { WebSocketResponseEvents } from '../schemas';
import type {
  CanvasListResultPayload,
  Result,
} from '../types';
import type {
  CanvasCreatePayload,
  CanvasListPayload,
  CanvasRenamePayload,
  CanvasDeletePayload,
  CanvasSwitchPayload,
  CanvasReorderPayload,
} from '../schemas';
import { canvasStore } from '../services/canvasStore.js';
import { socketService } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

function handleCanvasResult<T, R extends { requestId: string; success: boolean }>(
  connectionId: string,
  result: Result<T>,
  event: WebSocketResponseEvents,
  requestId: string,
  onSuccess: (data: T) => R,
  emitToAll: boolean = false
): boolean {
  if (!result.success) {
    socketService.emitToConnection(connectionId, event, {
      requestId,
      success: false,
      error: result.error,
    });
    return false;
  }

  const successResponse = onSuccess(result.data!);
  if (emitToAll) {
    socketService.emitToAll(event, successResponse);
  } else {
    socketService.emitToConnection(connectionId, event, successResponse);
  }
  return true;
}

export async function handleCanvasCreate(
  connectionId: string,
  payload: CanvasCreatePayload
): Promise<void> {
  const result = await canvasStore.create(payload.name);

  const success = handleCanvasResult(
    connectionId,
    result,
    WebSocketResponseEvents.CANVAS_CREATED,
    payload.requestId,
    (canvas) => ({
      requestId: payload.requestId,
      success: true,
      canvas: {
        id: canvas.id,
        name: canvas.name,
        createdAt: canvas.createdAt.toISOString(),
        sortIndex: canvas.sortIndex,
      },
    }),
    true
  );

  if (!success) return;

  const canvas = result.data!;
  logger.log('Canvas', 'Create', `Canvas created: ${canvas.name} (${canvas.id})`);
}

export async function handleCanvasList(
  connectionId: string,
  payload: CanvasListPayload
): Promise<void> {
  const canvases = canvasStore.list();
  const response: CanvasListResultPayload = {
    requestId: payload.requestId,
    success: true,
    canvases: canvases.map((canvas) => ({
      id: canvas.id,
      name: canvas.name,
      createdAt: canvas.createdAt.toISOString(),
      sortIndex: canvas.sortIndex,
    })),
  };

  socketService.emitToConnection(connectionId, WebSocketResponseEvents.CANVAS_LIST_RESULT, response);
}

export async function handleCanvasRename(
  connectionId: string,
  payload: CanvasRenamePayload
): Promise<void> {
  const result = await canvasStore.rename(payload.canvasId, payload.newName);

  const success = handleCanvasResult(
    connectionId,
    result,
    WebSocketResponseEvents.CANVAS_RENAMED,
    payload.requestId,
    (canvas) => ({
      requestId: payload.requestId,
      success: true,
      canvasId: canvas.id,
      newName: canvas.name,
      canvas: {
        id: canvas.id,
        name: canvas.name,
      },
    }),
    true
  );

  if (!success) return;

  const canvas = result.data!;
  logger.log('Canvas', 'Rename', `Canvas renamed: ${canvas.id} to ${canvas.name}`);
}

export async function handleCanvasDelete(
  connectionId: string,
  payload: CanvasDeletePayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    socketService.emitToConnection(connectionId, WebSocketResponseEvents.CANVAS_DELETED, {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    });
    return;
  }

  const activeCanvasId = canvasStore.getActiveCanvas(connectionId);
  if (activeCanvasId === payload.canvasId) {
    socketService.emitToConnection(connectionId, WebSocketResponseEvents.CANVAS_DELETED, {
      requestId: payload.requestId,
      success: false,
      error: '無法刪除正在使用的 Canvas',
    });
    return;
  }

  const result = await canvasStore.delete(payload.canvasId);

  const success = handleCanvasResult(
    connectionId,
    result,
    WebSocketResponseEvents.CANVAS_DELETED,
    payload.requestId,
    () => ({
      requestId: payload.requestId,
      success: true,
      canvasId: payload.canvasId,
    }),
    true
  );

  if (!success) return;

  logger.log('Canvas', 'Delete', `Canvas deleted: ${payload.canvasId}`);
}

export async function handleCanvasSwitch(
  connectionId: string,
  payload: CanvasSwitchPayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    socketService.emitToConnection(connectionId, WebSocketResponseEvents.CANVAS_SWITCHED, {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    });
    return;
  }

  canvasStore.setActiveCanvas(connectionId, payload.canvasId);
  socketService.joinCanvasRoom(connectionId, payload.canvasId);

  socketService.emitToConnection(connectionId, WebSocketResponseEvents.CANVAS_SWITCHED, {
    requestId: payload.requestId,
    success: true,
    canvasId: payload.canvasId,
  });

  logger.log('Canvas', 'Switch', `Connection ${connectionId} switched to canvas ${payload.canvasId}`);
}

export async function handleCanvasReorder(
  connectionId: string,
  payload: CanvasReorderPayload
): Promise<void> {
  const result = await canvasStore.reorder(payload.canvasIds);

  const success = handleCanvasResult(
    connectionId,
    result,
    WebSocketResponseEvents.CANVAS_REORDERED,
    payload.requestId,
    () => ({
      requestId: payload.requestId,
      success: true,
      canvasIds: payload.canvasIds,
    }),
    true
  );

  if (!success) return;

  logger.log('Canvas', 'Reorder', `Canvases reordered: ${payload.canvasIds.length} items`);
}
