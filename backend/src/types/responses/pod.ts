import type { Pod, PodStatus } from '../pod.js';
import type { MessageRole } from '../message.js';

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

export interface PodMovedPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodRenamedPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodModelSetPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodScheduleSetPayload {
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

export interface PodJoinedBatchPayload {
  joinedPodIds: string[];
  failedPodIds: string[];
}

export interface PodLeftPayload {
  podId: string;
}

export interface PodErrorPayload {
  requestId?: string;
  podId?: string;
  error: string;
  code: string;
}

export interface PodOutputStyleBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodOutputStyleUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodSkillBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodRepositoryBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodRepositoryUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodSubAgentBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodAutoClearSetPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodCommandBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodCommandUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodStatusChangedPayload {
  podId: string;
  status: PodStatus;
  previousStatus: PodStatus;
}

export interface PodMessagesClearedPayload {
  podId: string;
}
