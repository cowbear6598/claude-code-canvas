export interface OutputStyleListResultPayload {
  requestId: string;
  success: boolean;
  styles?: Array<{
    id: string;
    name: string;
  }>;
  error?: string;
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

export interface OutputStyleUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
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

export interface OutputStyleDeletedPayload {
  requestId: string;
  success: boolean;
  outputStyleId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
