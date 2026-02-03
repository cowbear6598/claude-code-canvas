import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodDeletePayload,
  type PodMovePayload,
  type PodRenamePayload,
  type PodSetModelPayload,
  type PodSetSchedulePayload,
} from '../../src/schemas/index.js';
import {
  type PodCreatedPayload,
  type PodDeletedPayload,
  type PodMovedPayload,
  type PodRenamedPayload,
  type PodModelSetPayload,
  type PodScheduleSetPayload,
  type Pod,
  type ModelType,
  type ScheduleConfigInput,
} from '../../src/types/index.js';

export async function createPod(
  client: Socket,
  overrides?: Partial<PodCreatePayload>
): Promise<Pod> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: PodCreatePayload = {
    requestId: uuidv4(),
    canvasId,
    name: 'Test Pod',
    color: 'blue',
    x: 0,
    y: 0,
    rotation: 0,
    ...overrides,
  };

  const response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
    client,
    WebSocketRequestEvents.POD_CREATE,
    WebSocketResponseEvents.POD_CREATED,
    payload
  );

  return response.pod!;
}

export async function createPodPair(
  client: Socket
): Promise<{ podA: Pod; podB: Pod }> {
  const podA = await createPod(client, { name: 'Pod A' });
  const podB = await createPod(client, { name: 'Pod B' });
  return { podA, podB };
}

export async function movePod(
  client: Socket,
  podId: string,
  x: number,
  y: number
): Promise<Pod> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: PodMovePayload = {
    requestId: uuidv4(),
    canvasId,
    podId,
    x,
    y,
  };

  const response = await emitAndWaitResponse<PodMovePayload, PodMovedPayload>(
    client,
    WebSocketRequestEvents.POD_MOVE,
    WebSocketResponseEvents.POD_MOVED,
    payload
  );

  return response.pod!;
}

export async function renamePod(
  client: Socket,
  podId: string,
  name: string
): Promise<Pod> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: PodRenamePayload = {
    requestId: uuidv4(),
    canvasId,
    podId,
    name,
  };

  const response = await emitAndWaitResponse<PodRenamePayload, PodRenamedPayload>(
    client,
    WebSocketRequestEvents.POD_RENAME,
    WebSocketResponseEvents.POD_RENAMED,
    payload
  );

  return response.pod!;
}

export async function setPodModel(
  client: Socket,
  podId: string,
  model: ModelType
): Promise<Pod> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: PodSetModelPayload = {
    requestId: uuidv4(),
    canvasId,
    podId,
    model,
  };

  const response = await emitAndWaitResponse<PodSetModelPayload, PodModelSetPayload>(
    client,
    WebSocketRequestEvents.POD_SET_MODEL,
    WebSocketResponseEvents.POD_MODEL_SET,
    payload
  );

  return response.pod!;
}

export async function setPodSchedule(
  client: Socket,
  podId: string,
  schedule: ScheduleConfigInput | null
): Promise<Pod> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: PodSetSchedulePayload = {
    requestId: uuidv4(),
    canvasId,
    podId,
    schedule,
  };

  const response = await emitAndWaitResponse<PodSetSchedulePayload, PodScheduleSetPayload>(
    client,
    WebSocketRequestEvents.POD_SET_SCHEDULE,
    WebSocketResponseEvents.POD_SCHEDULE_SET,
    payload
  );

  return response.pod!;
}

export async function deletePod(client: Socket, podId: string): Promise<void> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
    client,
    WebSocketRequestEvents.POD_DELETE,
    WebSocketResponseEvents.POD_DELETED,
    { requestId: uuidv4(), canvasId, podId }
  );
}
