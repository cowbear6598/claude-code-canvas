export interface CanvasCreatedPayload {
  requestId: string;
  success: boolean;
  canvas?: {
    id: string;
    name: string;
    createdAt: string;
  };
  error?: string;
}

export interface CanvasListResultPayload {
  requestId: string;
  success: boolean;
  canvases?: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  error?: string;
}

export interface CanvasRenamedPayload {
  requestId: string;
  success: boolean;
  canvas?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface CanvasDeletedPayload {
  requestId: string;
  success: boolean;
  canvasId?: string;
  error?: string;
}

export interface CanvasSwitchedPayload {
  requestId: string;
  success: boolean;
  canvasId?: string;
  error?: string;
}
