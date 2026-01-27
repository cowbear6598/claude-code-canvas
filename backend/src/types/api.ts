// API Type Definitions

import { Pod, PodTypeName, PodColor, ModelType } from './pod.js';

export interface CreatePodRequest {
  name: string;
  type: PodTypeName;
  color: PodColor;
  // Canvas-specific fields
  x: number;
  y: number;
  rotation: number;
  outputStyleId?: string | null;
  skillIds?: string[];
  model?: ModelType;
  repositoryId?: string | null;
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

export interface GitCloneRequest {
  repoUrl: string;
  branch?: string; // optional, defaults to main
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
