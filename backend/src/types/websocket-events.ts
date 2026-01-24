import type { Pod, PodColor, PodTypeName } from './pod.js';

export enum WebSocketRequestEvents {
  POD_CREATE = 'pod:create',
  POD_LIST = 'pod:list',
  POD_GET = 'pod:get',
  POD_UPDATE = 'pod:update',
  POD_DELETE = 'pod:delete',
  POD_GIT_CLONE = 'pod:git:clone',
  POD_CHAT_SEND = 'pod:chat:send',
  POD_CHAT_HISTORY = 'pod:chat:history',
  POD_JOIN = 'pod:join',
  POD_JOIN_BATCH = 'pod:join:batch',
  POD_LEAVE = 'pod:leave',
  OUTPUT_STYLE_LIST = 'output-style:list',
  POD_BIND_OUTPUT_STYLE = 'pod:bind-output-style',
  POD_UNBIND_OUTPUT_STYLE = 'pod:unbind-output-style',
  NOTE_CREATE = 'note:create',
  NOTE_LIST = 'note:list',
  NOTE_UPDATE = 'note:update',
  NOTE_DELETE = 'note:delete',
  SKILL_LIST = 'skill:list',
  SKILL_NOTE_CREATE = 'skill-note:create',
  SKILL_NOTE_LIST = 'skill-note:list',
  SKILL_NOTE_UPDATE = 'skill-note:update',
  SKILL_NOTE_DELETE = 'skill-note:delete',
  POD_BIND_SKILL = 'pod:bind-skill',
  CONNECTION_CREATE = 'connection:create',
  CONNECTION_LIST = 'connection:list',
  CONNECTION_DELETE = 'connection:delete',
  CONNECTION_UPDATE = 'connection:update',
  WORKFLOW_TRIGGER = 'workflow:trigger',
}

export enum WebSocketResponseEvents {
  CONNECTION_READY = 'connection:ready',
  POD_CREATED = 'pod:created',
  POD_LIST_RESULT = 'pod:list:result',
  POD_GET_RESULT = 'pod:get:result',
  POD_UPDATED = 'pod:updated',
  POD_DELETED = 'pod:deleted',
  POD_GIT_CLONE_PROGRESS = 'pod:git:clone:progress',
  POD_GIT_CLONE_RESULT = 'pod:git:clone:result',
  POD_CHAT_MESSAGE = 'pod:chat:message',
  POD_CHAT_TOOL_USE = 'pod:chat:tool_use',
  POD_CHAT_TOOL_RESULT = 'pod:chat:tool_result',
  POD_CHAT_COMPLETE = 'pod:chat:complete',
  POD_CHAT_HISTORY_RESULT = 'pod:chat:history:result',
  POD_JOINED = 'pod:joined',
  POD_JOINED_BATCH = 'pod:joined:batch',
  POD_LEFT = 'pod:left',
  POD_ERROR = 'pod:error',
  OUTPUT_STYLE_LIST_RESULT = 'output-style:list:result',
  POD_OUTPUT_STYLE_BOUND = 'pod:output-style:bound',
  POD_OUTPUT_STYLE_UNBOUND = 'pod:output-style:unbound',
  NOTE_CREATED = 'note:created',
  NOTE_LIST_RESULT = 'note:list:result',
  NOTE_UPDATED = 'note:updated',
  NOTE_DELETED = 'note:deleted',
  SKILL_LIST_RESULT = 'skill:list:result',
  SKILL_NOTE_CREATED = 'skill-note:created',
  SKILL_NOTE_LIST_RESULT = 'skill-note:list:result',
  SKILL_NOTE_UPDATED = 'skill-note:updated',
  SKILL_NOTE_DELETED = 'skill-note:deleted',
  POD_SKILL_BOUND = 'pod:skill:bound',
  CONNECTION_CREATED = 'connection:created',
  CONNECTION_LIST_RESULT = 'connection:list:result',
  CONNECTION_DELETED = 'connection:deleted',
  CONNECTION_UPDATED = 'connection:updated',
  WORKFLOW_TRIGGERED = 'workflow:triggered',
  WORKFLOW_AUTO_TRIGGERED = 'workflow:auto-triggered',
  WORKFLOW_COMPLETE = 'workflow:complete',
  WORKFLOW_ERROR = 'workflow:error',
}

export interface PodCreatePayload {
  requestId: string;
  name: string;
  type: PodTypeName;
  color: PodColor;
  x: number;
  y: number;
  rotation: number;
}

export interface PodListPayload {
  requestId: string;
}

export interface PodGetPayload {
  requestId: string;
  podId: string;
}

export interface PodUpdatePayload {
  requestId: string;
  podId: string;
  x?: number;
  y?: number;
  rotation?: number;
  name?: string;
}

export interface PodDeletePayload {
  requestId: string;
  podId: string;
}

export interface PodGitClonePayload {
  requestId: string;
  podId: string;
  repoUrl: string;
  branch?: string;
}

export interface PodChatSendPayload {
  requestId: string;
  podId: string;
  message: string;
}

export interface PodChatHistoryPayload {
  requestId: string;
  podId: string;
}

export interface PodJoinPayload {
  podId: string;
}

export interface PodJoinBatchPayload {
  podIds: string[];
}

export interface PodLeavePayload {
  podId: string;
}

export interface ConnectionReadyPayload {
  socketId: string;
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

export interface PodGitCloneProgressPayload {
  podId: string;
  progress: number;
  message: string;
}

export interface PodGitCloneResultPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface PodChatMessagePayload {
  podId: string;
  messageId: string;
  content: string;
  isPartial: boolean;
  role?: 'user' | 'assistant';
}

export interface PodChatToolUsePayload {
  podId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface PodChatToolResultPayload {
  podId: string;
  messageId: string;
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
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
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

export interface OutputStyleListPayload {
  requestId: string;
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

export interface PodBindOutputStylePayload {
  requestId: string;
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
  podId: string;
}

export interface PodOutputStyleUnboundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface NoteCreatePayload {
  requestId: string;
  outputStyleId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface NoteListPayload {
  requestId: string;
}

export interface NoteUpdatePayload {
  requestId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface NoteDeletePayload {
  requestId: string;
  noteId: string;
}

export interface NoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./outputStyleNote.js').OutputStyleNote;
  error?: string;
}

export interface NoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./outputStyleNote.js').OutputStyleNote[];
  error?: string;
}

export interface NoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./outputStyleNote.js').OutputStyleNote;
  error?: string;
}

export interface NoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface SkillListPayload {
  requestId: string;
}

export interface SkillNoteCreatePayload {
  requestId: string;
  skillId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface SkillNoteListPayload {
  requestId: string;
}

export interface SkillNoteUpdatePayload {
  requestId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface SkillNoteDeletePayload {
  requestId: string;
  noteId: string;
}

export interface PodBindSkillPayload {
  requestId: string;
  podId: string;
  skillId: string;
}

export interface SkillListResultPayload {
  requestId: string;
  success: boolean;
  skills?: import('./skill.js').Skill[];
  error?: string;
}

export interface SkillNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./skillNote.js').SkillNote;
  error?: string;
}

export interface SkillNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./skillNote.js').SkillNote[];
  error?: string;
}

export interface SkillNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./skillNote.js').SkillNote;
  error?: string;
}

export interface SkillNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
  error?: string;
}

export interface PodSkillBoundPayload {
  requestId: string;
  success: boolean;
  pod?: Pod;
  error?: string;
}

export interface ConnectionCreatePayload {
  requestId: string;
  sourcePodId: string;
  sourceAnchor: import('./connection.js').AnchorPosition;
  targetPodId: string;
  targetAnchor: import('./connection.js').AnchorPosition;
}

export interface ConnectionCreatedPayload {
  requestId: string;
  success: boolean;
  connection?: import('./connection.js').Connection;
  error?: string;
}

export interface ConnectionListPayload {
  requestId: string;
}

export interface ConnectionListResultPayload {
  requestId: string;
  success: boolean;
  connections?: import('./connection.js').Connection[];
  error?: string;
}

export interface ConnectionDeletePayload {
  requestId: string;
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
  connectionId: string;
  autoTrigger?: boolean;
}

export interface ConnectionUpdatedPayload {
  requestId: string;
  success: boolean;
  connection?: import('./connection.js').Connection;
  error?: string;
}

export interface WorkflowTriggerPayload {
  requestId: string;
  connectionId: string;
}

export interface WorkflowTriggeredPayload {
  requestId: string;
  success: boolean;
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  transferredContent: string;
  isSummarized?: boolean;
  error?: string;
}

export interface WorkflowCompletePayload {
  requestId: string;
  connectionId: string;
  targetPodId: string;
  success: boolean;
  error?: string;
}

export interface WorkflowErrorPayload {
  requestId: string;
  connectionId: string;
  error: string;
  code: string;
}

export interface WorkflowAutoTriggeredPayload {
  connectionId: string;
  sourcePodId: string;
  targetPodId: string;
  transferredContent: string;
  isSummarized: boolean;
}
