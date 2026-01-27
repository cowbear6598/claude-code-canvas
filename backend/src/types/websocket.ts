// WebSocket Event Type Definitions
// Re-exports from websocket-events.ts for backward compatibility and convenience

// Import and re-export all event types
export {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodListPayload,
  type PodGetPayload,
  type PodUpdatePayload,
  type PodDeletePayload,
  type PodGitClonePayload,
  type PodChatSendPayload,
  type PodChatHistoryPayload,
  type PodJoinPayload,
  type PodJoinBatchPayload,
  type PodLeavePayload,
  type ConnectionReadyPayload,
  type PodCreatedPayload,
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodUpdatedPayload,
  type PodDeletedPayload,
  type PodGitCloneProgressPayload,
  type PodGitCloneResultPayload,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type PodChatHistoryResultPayload,
  type PodJoinedPayload,
  type PodJoinedBatchPayload,
  type PodLeftPayload,
  type PodErrorPayload,
  type OutputStyleListPayload,
  type OutputStyleListResultPayload,
  type PodBindOutputStylePayload,
  type PodOutputStyleBoundPayload,
  type PodUnbindOutputStylePayload,
  type PodOutputStyleUnboundPayload,
  type NoteCreatePayload,
  type NoteListPayload,
  type NoteUpdatePayload,
  type NoteDeletePayload,
  type NoteCreatedPayload,
  type NoteListResultPayload,
  type NoteUpdatedPayload,
  type NoteDeletedPayload,
  type SkillListPayload,
  type SkillNoteCreatePayload,
  type SkillNoteListPayload,
  type SkillNoteUpdatePayload,
  type SkillNoteDeletePayload,
  type PodBindSkillPayload,
  type SkillListResultPayload,
  type SkillNoteCreatedPayload,
  type SkillNoteListResultPayload,
  type SkillNoteUpdatedPayload,
  type SkillNoteDeletedPayload,
  type PodSkillBoundPayload,
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type ConnectionListPayload,
  type ConnectionListResultPayload,
  type ConnectionDeletePayload,
  type ConnectionDeletedPayload,
  type ConnectionUpdatePayload,
  type ConnectionUpdatedPayload,
  type WorkflowTriggeredPayload,
  type WorkflowAutoTriggeredPayload,
  type WorkflowCompletePayload,
  type WorkflowErrorPayload,
  type WorkflowPendingPayload,
  type WorkflowSourcesMergedPayload,
  type WorkflowGetDownstreamPodsPayload,
  type WorkflowGetDownstreamPodsResultPayload,
  type WorkflowClearPayload,
  type WorkflowClearResultPayload,
  type PastePodItem,
  type PasteOutputStyleNoteItem,
  type PasteSkillNoteItem,
  type CanvasPastePayload,
  type PasteError,
  type CanvasPasteResultPayload,
  type RepositoryListPayload,
  type RepositoryListResultPayload,
  type RepositoryCreatePayload,
  type RepositoryCreatedPayload,
  type RepositoryNoteCreatePayload,
  type RepositoryNoteCreatedPayload,
  type RepositoryNoteListPayload,
  type RepositoryNoteListResultPayload,
  type RepositoryNoteUpdatePayload,
  type RepositoryNoteUpdatedPayload,
  type RepositoryNoteDeletePayload,
  type RepositoryNoteDeletedPayload,
  type PodBindRepositoryPayload,
  type PodRepositoryBoundPayload,
  type PodUnbindRepositoryPayload,
  type PodRepositoryUnboundPayload,
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
