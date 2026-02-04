import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  CanvasCreatedPayload,
  CanvasListResultPayload,
  CanvasRenamedPayload,
  CanvasDeletedPayload,
  CanvasSwitchedPayload,
  CanvasReorderedPayload,
  BroadcastCanvasCreatedPayload,
  BroadcastCanvasRenamedPayload,
  BroadcastCanvasDeletedPayload,
  BroadcastCanvasReorderedPayload,
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
      sortIndex: canvas.sortIndex,
    },
  };

  socket.emit(WebSocketResponseEvents.CANVAS_CREATED, response);

  const broadcastPayload: BroadcastCanvasCreatedPayload = {
    canvas: {
      id: canvas.id,
      name: canvas.name,
      createdAt: canvas.createdAt.toISOString(),
      sortIndex: canvas.sortIndex,
    },
  };
  socketService.broadcastToAll(socket.id, WebSocketResponseEvents.BROADCAST_CANVAS_CREATED, broadcastPayload);

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
  socketService.broadcastToAll(socket.id, WebSocketResponseEvents.BROADCAST_CANVAS_RENAMED, broadcastPayload);

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
  socketService.broadcastToAll(socket.id, WebSocketResponseEvents.BROADCAST_CANVAS_DELETED, broadcastPayload);

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

export async function handleCanvasReorder(
  socket: Socket,
  payload: CanvasReorderPayload
): Promise<void> {
  const result = await canvasStore.reorder(payload.canvasIds);

  if (!result.success) {
    const response: CanvasReorderedPayload = {
      requestId: payload.requestId,
      success: false,
      error: result.error,
    };
    socket.emit(WebSocketResponseEvents.CANVAS_REORDERED, response);
    return;
  }

  const response: CanvasReorderedPayload = {
    requestId: payload.requestId,
    success: true,
  };

  socket.emit(WebSocketResponseEvents.CANVAS_REORDERED, response);

  const broadcastPayload: BroadcastCanvasReorderedPayload = {
    canvasIds: payload.canvasIds,
  };
  socketService.broadcastToAll(socket.id, WebSocketResponseEvents.BROADCAST_CANVAS_REORDERED, broadcastPayload);

  logger.log('Canvas', 'Reorder', `Canvases reordered: ${payload.canvasIds.length} items`);
}
