export interface OutputStyleListPayload {
  requestId: string;
  canvasId: string;
}

export interface OutputStyleListResultPayload {
  requestId: string;
  success: boolean;
  styles?: Array<{
    id: string;
    name: string;
  }>;
  error?: string;
}

export interface OutputStyleCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  content: string;
}

export interface OutputStyleCreatedPayload {
  requestId: string;
  success: boolean;
  outputStyle?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface OutputStyleUpdatePayload {
  requestId: string;
  canvasId: string;
  outputStyleId: string;
  content: string;
}

export interface OutputStyleUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
}

export interface OutputStyleReadPayload {
  requestId: string;
  canvasId: string;
  outputStyleId: string;
}

export interface OutputStyleReadResultPayload {
  requestId: string;
  success: boolean;
  outputStyle?: {
    id: string;
    name: string;
    content: string;
  };
  error?: string;
}

export interface OutputStyleDeletePayload {
  requestId: string;
  canvasId: string;
  outputStyleId: string;
}

export interface OutputStyleDeletedPayload {
  requestId: string;
  success: boolean;
  outputStyleId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
