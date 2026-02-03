import type { Connection } from '../connection.js';

export interface ConnectionCreatedPayload {
  requestId: string;
  success: boolean;
  connection?: Connection;
  error?: string;
}

export interface ConnectionListResultPayload {
  requestId: string;
  success: boolean;
  connections?: Connection[];
  error?: string;
}

export interface ConnectionDeletedPayload {
  requestId: string;
  success: boolean;
  connectionId?: string;
  error?: string;
}

export interface ConnectionUpdatedPayload {
  requestId: string;
  success: boolean;
  connection?: Connection;
  error?: string;
}

export interface ConnectionReadyPayload {
  socketId: string;
}
