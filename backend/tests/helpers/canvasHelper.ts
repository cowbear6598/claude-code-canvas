import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type CanvasCreatePayload,
  type CanvasListPayload,
  type CanvasRenamePayload,
  type CanvasDeletePayload,
  type CanvasSwitchPayload,
  type CanvasReorderPayload,
} from '../../src/schemas/index.js';
import {
  type CanvasCreatedPayload,
  type CanvasListResultPayload,
  type CanvasRenamedPayload,
  type CanvasDeletedPayload,
  type CanvasSwitchedPayload,
  type CanvasReorderedPayload,
} from '../../src/types/index.js';

export async function getCanvasId(client: Socket): Promise<string> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  return canvasId;
}

export async function createCanvas(
  client: Socket,
  name?: string
): Promise<{ id: string; name: string; createdAt: string; sortIndex: number }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasCreatePayload = {
    requestId: uuidv4(),
    name: name || 'Test Canvas',
  };

  const response = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
    client,
    WebSocketRequestEvents.CANVAS_CREATE,
    WebSocketResponseEvents.CANVAS_CREATED,
    payload
  );

  return response.canvas!;
}

export async function listCanvases(
  client: Socket
): Promise<{ id: string; name: string; createdAt: string; sortIndex: number }[]> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasListPayload = {
    requestId: uuidv4(),
  };

  const response = await emitAndWaitResponse<CanvasListPayload, CanvasListResultPayload>(
    client,
    WebSocketRequestEvents.CANVAS_LIST,
    WebSocketResponseEvents.CANVAS_LIST_RESULT,
    payload
  );

  return response.canvases || [];
}

export async function reorderCanvases(
  client: Socket,
  canvasIds: string[]
): Promise<CanvasReorderedPayload> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasReorderPayload = {
    requestId: uuidv4(),
    canvasIds,
  };

  const response = await emitAndWaitResponse<CanvasReorderPayload, CanvasReorderedPayload>(
    client,
    WebSocketRequestEvents.CANVAS_REORDER,
    WebSocketResponseEvents.CANVAS_REORDERED,
    payload
  );

  return response;
}
