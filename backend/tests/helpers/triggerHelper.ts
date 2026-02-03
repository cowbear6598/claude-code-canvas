import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type TriggerCreatePayload,
  type TriggerListPayload,
  type TriggerUpdatePayload,
  type TriggerDeletePayload,
  type ConnectionCreatePayload,
} from '../../src/schemas/index.js';
import {
  type TriggerCreatedPayload,
  type TriggerListResultPayload,
  type TriggerUpdatedPayload,
  type TriggerDeletedPayload,
  type ConnectionCreatedPayload,
  type Trigger,
  type Connection,
  type TimeTriggerConfig,
} from '../../src/types/index.js';

export async function createTrigger(
  client: Socket,
  overrides?: Partial<TriggerCreatePayload>
): Promise<Trigger> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const defaultConfig: TimeTriggerConfig = {
    frequency: 'every-second',
    second: 0,
    intervalMinute: 1,
    intervalHour: 1,
    hour: 0,
    minute: 0,
    weekdays: [],
  };

  const payload: TriggerCreatePayload = {
    requestId: uuidv4(),
    canvasId,
    name: 'Test Trigger',
    type: 'time',
    x: 0,
    y: 0,
    rotation: 0,
    enabled: true,
    ...overrides,
    config: overrides?.config ? { ...defaultConfig, ...overrides.config } as TimeTriggerConfig : defaultConfig,
  };

  const response = await emitAndWaitResponse<TriggerCreatePayload, TriggerCreatedPayload>(
    client,
    WebSocketRequestEvents.TRIGGER_CREATE,
    WebSocketResponseEvents.TRIGGER_CREATED,
    payload
  );

  return response.trigger!;
}

export async function createTriggerConnection(
  client: Socket,
  triggerId: string,
  targetPodId: string
): Promise<Connection> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: ConnectionCreatePayload = {
    requestId: uuidv4(),
    canvasId,
    sourceType: 'trigger',
    sourceTriggerId: triggerId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
  };

  const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
    client,
    WebSocketRequestEvents.CONNECTION_CREATE,
    WebSocketResponseEvents.CONNECTION_CREATED,
    payload
  );

  return response.connection!;
}

export async function listTriggers(client: Socket): Promise<Trigger[]> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: TriggerListPayload = {
    requestId: uuidv4(),
    canvasId,
  };

  const response = await emitAndWaitResponse<TriggerListPayload, TriggerListResultPayload>(
    client,
    WebSocketRequestEvents.TRIGGER_LIST,
    WebSocketResponseEvents.TRIGGER_LIST_RESULT,
    payload
  );

  return response.triggers!;
}

export async function updateTrigger(
  client: Socket,
  triggerId: string,
  updates: Partial<Omit<TriggerUpdatePayload, 'requestId' | 'canvasId' | 'triggerId'>>
): Promise<Trigger> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: TriggerUpdatePayload = {
    requestId: uuidv4(),
    canvasId,
    triggerId,
    ...updates,
  };

  const response = await emitAndWaitResponse<TriggerUpdatePayload, TriggerUpdatedPayload>(
    client,
    WebSocketRequestEvents.TRIGGER_UPDATE,
    WebSocketResponseEvents.TRIGGER_UPDATED,
    payload
  );

  return response.trigger!;
}

export async function deleteTrigger(
  client: Socket,
  triggerId: string
): Promise<{ triggerId: string; deletedConnectionIds: string[] }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const payload: TriggerDeletePayload = {
    requestId: uuidv4(),
    canvasId,
    triggerId,
  };

  const response = await emitAndWaitResponse<TriggerDeletePayload, TriggerDeletedPayload>(
    client,
    WebSocketRequestEvents.TRIGGER_DELETE,
    WebSocketResponseEvents.TRIGGER_DELETED,
    payload
  );

  return {
    triggerId: response.triggerId!,
    deletedConnectionIds: response.deletedConnectionIds || [],
  };
}
