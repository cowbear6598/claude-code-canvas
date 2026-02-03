import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
} from '../../src/schemas/index.js';
import {
  type ConnectionCreatedPayload,
  type Connection,
} from '../../src/types/index.js';

export async function createConnection(
  client: Socket,
  sourcePodId: string,
  targetPodId: string,
  overrides?: Partial<ConnectionCreatePayload>
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
    sourceType: 'pod',
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    ...overrides,
  };

  const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
    client,
    WebSocketRequestEvents.CONNECTION_CREATE,
    WebSocketResponseEvents.CONNECTION_CREATED,
    payload
  );

  return response.connection!;
}
