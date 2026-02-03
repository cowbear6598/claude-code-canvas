import type { Pod, PodColor, ModelType } from '../pod.js';
import type { ContentBlock, MessageRole } from '../message.js';

export interface PodCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  color: PodColor;
  x: number;
  y: number;
  rotation: number;
}

export interface PodListPayload {
  requestId: string;
  canvasId: string;
}

export interface PodGetPayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodUpdatePayload {
  requestId: string;
  canvasId: string;
  podId: string;
  x?: number;
  y?: number;
  rotation?: number;
  name?: string;
  model?: ModelType;
}

export interface PodDeletePayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodChatSendPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  message: string | ContentBlock[];
}

export interface PodChatHistoryPayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodJoinPayload {
  canvasId: string;
  podId: string;
}

export interface PodJoinBatchPayload {
  canvasId: string;
  podIds: string[];
}

export interface PodLeavePayload {
  canvasId: string;
  podId: string;
}

export interface PodCreatedPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodListResultPayload {
  requestId: string;
  success: boolean;
  pods?: Pod[];
  error?: string;
}

export interface PodGetResultPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodUpdatedPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodDeletedPayload {
  requestId: string;
  success: boolean;
  podId?: string;
  error?: string;
}

export interface PodChatMessagePayload {
  podId: string;
  messageId: string;
  content: string;
  isPartial: boolean;
  role?: MessageRole;
}

export interface PodChatToolUsePayload {
  podId: string;
  messageId: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface PodChatToolResultPayload {
  podId: string;
  messageId: string;
  toolUseId: string;
  toolName: string;
  output: string;
}

export interface PodChatCompletePayload {
  podId: string;
  messageId: string;
  fullContent: string;
}

export interface PodChatHistoryResultPayload {
  requestId: string;
  success: boolean;
  messages?: Array<{
    id: string;
    role: MessageRole;
    content: string;
    timestamp: string;
    subMessages?: Array<{
      id: string;
      content: string;
      toolUse?: Array<{
        toolUseId: string;
        toolName: string;
        input: Record<string, unknown>;
        output?: string;
        status: string;
      }>;
    }>;
  }>;
  error?: string;
}

export interface PodJoinedPayload {
  podId: string;
}

export interface PodErrorPayload {
  requestId?: string;
  podId?: string;
  error: string;
  code: string;
}

export interface PodBindOutputStylePayload {
  requestId: string;
  canvasId: string;
  podId: string;
  outputStyleId: string;
}

export interface PodOutputStyleBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodUnbindOutputStylePayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodOutputStyleUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodBindSkillPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  skillId: string;
}

export interface PodSkillBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodBindRepositoryPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  repositoryId: string;
}

export interface PodRepositoryBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodUnbindRepositoryPayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodRepositoryUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodBindSubAgentPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  subAgentId: string;
}

export interface PodSubAgentBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodSetAutoClearPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  autoClear: boolean;
}

export interface PodAutoClearSetPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodBindCommandPayload {
  requestId: string;
  canvasId: string;
  podId: string;
  commandId: string;
}

export interface PodCommandBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodUnbindCommandPayload {
  requestId: string;
  canvasId: string;
  podId: string;
}

export interface PodCommandUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}
