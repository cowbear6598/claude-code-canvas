import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type PodDeletePayload,
  type PodDeletedPayload,
  type Pod,
} from '../../src/types/index.js';

export async function createPod(
  client: Socket,
  overrides?: Partial<PodCreatePayload>
): Promise<Pod> {
  const payload: PodCreatePayload = {
    requestId: uuidv4(),
    name: 'Test Pod',
    type: 'General AI',
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

export async function deletePod(client: Socket, podId: string): Promise<void> {
  await emitAndWaitResponse<PodDeletePayload, PodDeletedPayload>(
    client,
    WebSocketRequestEvents.POD_DELETE,
    WebSocketResponseEvents.POD_DELETED,
    { requestId: uuidv4(), podId }
  );
}
