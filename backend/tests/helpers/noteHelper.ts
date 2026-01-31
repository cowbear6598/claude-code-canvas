import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { emitAndWaitResponse } from '../setup/index.js';

export async function createNote<TPayload, TResponse>(
  client: Socket,
  requestEvent: string,
  responseEvent: string,
  payload: Omit<TPayload, 'requestId'>
): Promise<TResponse> {
  const fullPayload = { requestId: uuidv4(), ...payload } as TPayload;

  return emitAndWaitResponse<TPayload, TResponse>(
    client,
    requestEvent,
    responseEvent,
    fullPayload
  );
}
