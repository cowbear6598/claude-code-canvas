// WebSocket Event Type Definitions
// Re-exports from websocket-events.ts for backward compatibility and convenience

// Import and re-export all event types
export {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodListPayload,
  type PodGetPayload,
  type PodDeletePayload,
  type PodGitClonePayload,
  type PodChatSendPayload,
  type PodJoinPayload,
  type PodLeavePayload,
  type ConnectionReadyPayload,
  type PodCreatedPayload,
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodDeletedPayload,
  type PodGitCloneProgressPayload,
  type PodGitCloneResultPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type PodJoinedPayload,
  type PodLeftPayload,
  type PodErrorPayload,
} from './websocket-events.js';

// Legacy enum for backward compatibility (deprecated)
// @deprecated Use WebSocketResponseEvents instead
export enum WebSocketEvents {
  POD_MESSAGE = 'pod:message',
  POD_TOOL_USE = 'pod:tool_use',
  POD_COMPLETE = 'pod:complete',
  POD_ERROR = 'pod:error',
}

// Legacy types for backward compatibility (deprecated)
// @deprecated Use PodChatMessagePayload instead
export interface PodMessagePayload {
  podId: string;
  messageId: string;
  content: string;
  isPartial: boolean;
}

// @deprecated Use PodChatToolUsePayload instead
export interface PodToolUsePayload {
  podId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
}

// @deprecated Use PodChatCompletePayload instead
export interface PodCompletePayload {
  podId: string;
  messageId: string;
}
