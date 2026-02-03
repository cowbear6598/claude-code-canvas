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
} from '../../src/schemas/index.js';
import {
  type CanvasCreatedPayload,
  type CanvasListResultPayload,
  type CanvasRenamedPayload,
  type CanvasDeletedPayload,
  type CanvasSwitchedPayload,
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
): Promise<{ id: string; name: string; createdAt: string }> {
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
): Promise<{ id: string; name: string; createdAt: string }[]> {
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

export async function renameCanvas(
  client: Socket,
  canvasId: string,
  newName: string
): Promise<{ id: string; name: string }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasRenamePayload = {
    requestId: uuidv4(),
    canvasId,
    newName,
  };

  const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
    client,
    WebSocketRequestEvents.CANVAS_RENAME,
    WebSocketResponseEvents.CANVAS_RENAMED,
    payload
  );

  return response.canvas!;
}

export async function deleteCanvas(
  client: Socket,
  canvasId: string
): Promise<void> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasDeletePayload = {
    requestId: uuidv4(),
    canvasId,
  };

  await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
    client,
    WebSocketRequestEvents.CANVAS_DELETE,
    WebSocketResponseEvents.CANVAS_DELETED,
    payload
  );
}

export async function switchCanvas(
  client: Socket,
  canvasId: string
): Promise<void> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const payload: CanvasSwitchPayload = {
    requestId: uuidv4(),
    canvasId,
  };

  await emitAndWaitResponse<CanvasSwitchPayload, CanvasSwitchedPayload>(
    client,
    WebSocketRequestEvents.CANVAS_SWITCH,
    WebSocketResponseEvents.CANVAS_SWITCHED,
    payload
  );
}
