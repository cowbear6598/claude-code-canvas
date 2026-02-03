export interface ConnectionCreatePayload {
  requestId: string;
  canvasId: string;
  sourcePodId: string;
  sourceAnchor: import('../connection.js').AnchorPosition;
  targetPodId: string;
  targetAnchor: import('../connection.js').AnchorPosition;
}

export interface ConnectionCreatedPayload {
  requestId: string;
  success: boolean;
  connection?: import('../connection.js').Connection;
  error?: string;
}

export interface ConnectionListPayload {
  requestId: string;
  canvasId: string;
}

export interface ConnectionListResultPayload {
  requestId: string;
  success: boolean;
  connections?: import('../connection.js').Connection[];
  error?: string;
}

export interface ConnectionDeletePayload {
  requestId: string;
  canvasId: string;
  connectionId: string;
}

export interface ConnectionDeletedPayload {
  requestId: string;
  success: boolean;
  connectionId?: string;
  error?: string;
}

export interface ConnectionUpdatePayload {
  requestId: string;
  canvasId: string;
  connectionId: string;
  autoTrigger?: boolean;
}

export interface ConnectionUpdatedPayload {
  requestId: string;
  success: boolean;
  connection?: import('../connection.js').Connection;
  error?: string;
}
