import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type Connection,
} from '../../src/types/index.js';

export async function createConnection(
  client: Socket,
  sourcePodId: string,
  targetPodId: string,
  overrides?: Partial<ConnectionCreatePayload>
): Promise<Connection> {
  const payload: ConnectionCreatePayload = {
    requestId: uuidv4(),
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
