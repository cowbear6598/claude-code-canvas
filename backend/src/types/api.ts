import { Pod, PodColor, ModelType } from './pod.js';

export interface CreatePodRequest {
  name: string;
  color: PodColor;
  x: number;
  y: number;
  rotation: number;
  outputStyleId?: string | null;
  skillIds?: string[];
  subAgentIds?: string[];
  mcpServerIds?: string[];
  model?: ModelType;
  repositoryId?: string | null;
  commandId?: string | null;
}

export interface CreatePodResponse {
  pod: Pod;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  messageId: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
