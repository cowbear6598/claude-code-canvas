import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  CanvasListResultPayload,
  Result,
} from '../types/index.js';
import type {
  CanvasCreatePayload,
  CanvasListPayload,
  CanvasRenamePayload,
  CanvasDeletePayload,
  CanvasSwitchPayload,
  CanvasReorderPayload,
} from '../schemas/index.js';
import { canvasStore } from '../services/canvasStore.js';
import { socketService } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

function handleCanvasResult<T>(
  socket: Socket,
  result: Result<T>,
  event: WebSocketResponseEvents,
  requestId: string,
  onSuccess: (data: T) => any,
  emitToAll: boolean = false
): boolean {
  if (!result.success) {
    socket.emit(event, {
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
    socket.emit(event, successResponse);
  }
  return true;
}

export async function handleCanvasCreate(
  socket: Socket,
  payload: CanvasCreatePayload
): Promise<void> {
  const result = await canvasStore.create(payload.name);

  const success = handleCanvasResult(
    socket,
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
  socket: Socket,
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

  socket.emit(WebSocketResponseEvents.CANVAS_LIST_RESULT, response);
}

export async function handleCanvasRename(
  socket: Socket,
  payload: CanvasRenamePayload
): Promise<void> {
  const result = await canvasStore.rename(payload.canvasId, payload.newName);

  const success = handleCanvasResult(
    socket,
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
  socket: Socket,
  payload: CanvasDeletePayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    socket.emit(WebSocketResponseEvents.CANVAS_DELETED, {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    });
    return;
  }

  const activeCanvasId = canvasStore.getActiveCanvas(socket.id);
  if (activeCanvasId === payload.canvasId) {
    socket.emit(WebSocketResponseEvents.CANVAS_DELETED, {
      requestId: payload.requestId,
      success: false,
      error: '無法刪除正在使用的 Canvas',
    });
    return;
  }

  const result = await canvasStore.delete(payload.canvasId);

  const success = handleCanvasResult(
    socket,
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
  socket: Socket,
  payload: CanvasSwitchPayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    socket.emit(WebSocketResponseEvents.CANVAS_SWITCHED, {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    });
    return;
  }

  canvasStore.setActiveCanvas(socket.id, payload.canvasId);
  socketService.joinCanvasRoom(socket.id, payload.canvasId);

  socket.emit(WebSocketResponseEvents.CANVAS_SWITCHED, {
    requestId: payload.requestId,
    success: true,
    canvasId: payload.canvasId,
  });

  logger.log('Canvas', 'Switch', `Socket ${socket.id} switched to canvas ${payload.canvasId}`);
}

export async function handleCanvasReorder(
  socket: Socket,
  payload: CanvasReorderPayload
): Promise<void> {
  const result = await canvasStore.reorder(payload.canvasIds);

  const success = handleCanvasResult(
    socket,
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
