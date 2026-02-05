import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
  type ConnectionUpdatePayload,
} from '../../src/schemas';
import {
  type ConnectionCreatedPayload,
  type ConnectionUpdatedPayload,
  type Connection,
} from '../../src/types';

interface CreateConnectionOptions extends Partial<ConnectionCreatePayload> {
  autoTrigger?: boolean;
}

export async function createConnection(
  client: TestWebSocketClient,
  sourcePodId: string,
  targetPodId: string,
  options?: CreateConnectionOptions
): Promise<Connection> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const { autoTrigger, ...createOverrides } = options || {};

  const payload: ConnectionCreatePayload = {
    requestId: uuidv4(),
    canvasId,
    sourcePodId,
    sourceAnchor: 'right',
    targetPodId,
    targetAnchor: 'left',
    ...createOverrides,
  };

  const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
    client,
    WebSocketRequestEvents.CONNECTION_CREATE,
    WebSocketResponseEvents.CONNECTION_CREATED,
    payload
  );

  const connection = response.connection!;

  if (autoTrigger !== undefined) {
    const updatePayload: ConnectionUpdatePayload = {
      requestId: uuidv4(),
      canvasId,
      connectionId: connection.id,
      autoTrigger,
    };

    const updateResponse = await emitAndWaitResponse<ConnectionUpdatePayload, ConnectionUpdatedPayload>(
      client,
      WebSocketRequestEvents.CONNECTION_UPDATE,
      WebSocketResponseEvents.CONNECTION_UPDATED,
      updatePayload
    );

    return updateResponse.connection!;
  }

  return connection;
}
