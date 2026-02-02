import type { Socket } from 'socket.io';
import type {
  CanvasCreatePayload,
  CanvasListPayload,
  CanvasRenamePayload,
  CanvasDeletePayload,
  CanvasSwitchPayload,
  CanvasCreatedPayload,
  CanvasListResultPayload,
  CanvasRenamedPayload,
  CanvasDeletedPayload,
  CanvasSwitchedPayload,
  BroadcastCanvasRenamedPayload,
  BroadcastCanvasDeletedPayload,
} from '../types/index.js';
import { WebSocketResponseEvents } from '../types/index.js';
import { canvasStore } from '../services/canvasStore.js';
import { socketService } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

export async function handleCanvasCreate(
  socket: Socket,
  payload: CanvasCreatePayload
): Promise<void> {
  const result = await canvasStore.create(payload.name);

  if (!result.success) {
    const response: CanvasCreatedPayload = {
      requestId: payload.requestId,
      success: false,
      error: result.error,
    };
    socket.emit(WebSocketResponseEvents.CANVAS_CREATED, response);
    return;
  }

  const canvas = result.data!;
  const response: CanvasCreatedPayload = {
    requestId: payload.requestId,
    success: true,
    canvas: {
      id: canvas.id,
      name: canvas.name,
      createdAt: canvas.createdAt.toISOString(),
    },
  };

  socket.emit(WebSocketResponseEvents.CANVAS_CREATED, response);
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
    })),
  };

  socket.emit(WebSocketResponseEvents.CANVAS_LIST_RESULT, response);
}

export async function handleCanvasRename(
  socket: Socket,
  payload: CanvasRenamePayload
): Promise<void> {
  const result = await canvasStore.rename(payload.canvasId, payload.newName);

  if (!result.success) {
    const response: CanvasRenamedPayload = {
      requestId: payload.requestId,
      success: false,
      error: result.error,
    };
    socket.emit(WebSocketResponseEvents.CANVAS_RENAMED, response);
    return;
  }

  const canvas = result.data!;
  const response: CanvasRenamedPayload = {
    requestId: payload.requestId,
    success: true,
    canvas: {
      id: canvas.id,
      name: canvas.name,
    },
  };

  socket.emit(WebSocketResponseEvents.CANVAS_RENAMED, response);

  const broadcastPayload: BroadcastCanvasRenamedPayload = {
    canvasId: payload.canvasId,
    newName: payload.newName,
  };
  socketService.broadcastToCanvas(socket.id, payload.canvasId, WebSocketResponseEvents.BROADCAST_CANVAS_RENAMED, broadcastPayload);

  logger.log('Canvas', 'Rename', `Canvas renamed: ${canvas.id} to ${canvas.name}`);
}

export async function handleCanvasDelete(
  socket: Socket,
  payload: CanvasDeletePayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    const response: CanvasDeletedPayload = {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    };
    socket.emit(WebSocketResponseEvents.CANVAS_DELETED, response);
    return;
  }

  const activeCanvasId = canvasStore.getActiveCanvas(socket.id);
  if (activeCanvasId === payload.canvasId) {
    const response: CanvasDeletedPayload = {
      requestId: payload.requestId,
      success: false,
      error: '無法刪除正在使用的 Canvas',
    };
    socket.emit(WebSocketResponseEvents.CANVAS_DELETED, response);
    return;
  }

  const result = await canvasStore.delete(payload.canvasId);

  if (!result.success) {
    const response: CanvasDeletedPayload = {
      requestId: payload.requestId,
      success: false,
      error: result.error,
    };
    socket.emit(WebSocketResponseEvents.CANVAS_DELETED, response);
    return;
  }

  const response: CanvasDeletedPayload = {
    requestId: payload.requestId,
    success: true,
    canvasId: payload.canvasId,
  };

  socket.emit(WebSocketResponseEvents.CANVAS_DELETED, response);

  const broadcastPayload: BroadcastCanvasDeletedPayload = {
    canvasId: payload.canvasId,
  };
  socketService.broadcastToCanvas(socket.id, payload.canvasId, WebSocketResponseEvents.BROADCAST_CANVAS_DELETED, broadcastPayload);

  logger.log('Canvas', 'Delete', `Canvas deleted: ${payload.canvasId}`);
}

export async function handleCanvasSwitch(
  socket: Socket,
  payload: CanvasSwitchPayload
): Promise<void> {
  const canvas = canvasStore.getById(payload.canvasId);
  if (!canvas) {
    const response: CanvasSwitchedPayload = {
      requestId: payload.requestId,
      success: false,
      error: '找不到 Canvas',
    };
    socket.emit(WebSocketResponseEvents.CANVAS_SWITCHED, response);
    return;
  }

  canvasStore.setActiveCanvas(socket.id, payload.canvasId);
  socketService.joinCanvasRoom(socket.id, payload.canvasId);

  const response: CanvasSwitchedPayload = {
    requestId: payload.requestId,
    success: true,
    canvasId: payload.canvasId,
  };

  socket.emit(WebSocketResponseEvents.CANVAS_SWITCHED, response);
  logger.log('Canvas', 'Switch', `Socket ${socket.id} switched to canvas ${payload.canvasId}`);
}
