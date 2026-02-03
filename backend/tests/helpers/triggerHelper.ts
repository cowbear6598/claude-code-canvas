import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type TriggerCreatePayload,
  type ConnectionCreatePayload,
} from '../../src/schemas/index.js';
import {
  type TriggerCreatedPayload,
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
