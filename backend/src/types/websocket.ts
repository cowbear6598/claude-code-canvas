import type { Pod, PodColor, ModelType } from './pod.js';
import type { ContentBlock, MessageRole } from './message.js';

export enum WebSocketRequestEvents {
  POD_CREATE = 'pod:create',
  POD_LIST = 'pod:list',
  POD_GET = 'pod:get',
  POD_UPDATE = 'pod:update',
  POD_DELETE = 'pod:delete',
  POD_CHAT_SEND = 'pod:chat:send',
  POD_CHAT_HISTORY = 'pod:chat:history',
  POD_JOIN = 'pod:join',
  POD_JOIN_BATCH = 'pod:join:batch',
  POD_LEAVE = 'pod:leave',
  OUTPUT_STYLE_LIST = 'output-style:list',
  OUTPUT_STYLE_CREATE = 'output-style:create',
  OUTPUT_STYLE_UPDATE = 'output-style:update',
  OUTPUT_STYLE_READ = 'output-style:read',
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
  WORKFLOW_GET_DOWNSTREAM_PODS = 'workflow:get-downstream-pods',
  WORKFLOW_CLEAR = 'workflow:clear',
  CANVAS_PASTE = 'canvas:paste',
  REPOSITORY_LIST = 'repository:list',
  REPOSITORY_CREATE = 'repository:create',
  REPOSITORY_NOTE_CREATE = 'repository-note:create',
  REPOSITORY_NOTE_LIST = 'repository-note:list',
  REPOSITORY_NOTE_UPDATE = 'repository-note:update',
  REPOSITORY_NOTE_DELETE = 'repository-note:delete',
  POD_BIND_REPOSITORY = 'pod:bind-repository',
  POD_UNBIND_REPOSITORY = 'pod:unbind-repository',
  OUTPUT_STYLE_DELETE = 'output-style:delete',
  SKILL_DELETE = 'skill:delete',
  REPOSITORY_DELETE = 'repository:delete',
  SUBAGENT_LIST = 'subagent:list',
  SUBAGENT_CREATE = 'subagent:create',
  SUBAGENT_UPDATE = 'subagent:update',
  SUBAGENT_READ = 'subagent:read',
  SUBAGENT_NOTE_CREATE = 'subagent-note:create',
  SUBAGENT_NOTE_LIST = 'subagent-note:list',
  SUBAGENT_NOTE_UPDATE = 'subagent-note:update',
  SUBAGENT_NOTE_DELETE = 'subagent-note:delete',
  POD_BIND_SUBAGENT = 'pod:bind-subagent',
  SUBAGENT_DELETE = 'subagent:delete',
  POD_SET_AUTO_CLEAR = 'pod:set-auto-clear',
  COMMAND_LIST = 'command:list',
  COMMAND_CREATE = 'command:create',
  COMMAND_UPDATE = 'command:update',
  COMMAND_READ = 'command:read',
  COMMAND_NOTE_CREATE = 'command-note:create',
  COMMAND_NOTE_LIST = 'command-note:list',
  COMMAND_NOTE_UPDATE = 'command-note:update',
  COMMAND_NOTE_DELETE = 'command-note:delete',
  POD_BIND_COMMAND = 'pod:bind-command',
  POD_UNBIND_COMMAND = 'pod:unbind-command',
  COMMAND_DELETE = 'command:delete',
  REPOSITORY_GIT_CLONE = 'repository:git:clone',
  TRIGGER_CREATE = 'trigger:create',
  TRIGGER_LIST = 'trigger:list',
  TRIGGER_UPDATE = 'trigger:update',
  TRIGGER_DELETE = 'trigger:delete',
  CANVAS_CREATE = 'canvas:create',
  CANVAS_LIST = 'canvas:list',
  CANVAS_RENAME = 'canvas:rename',
  CANVAS_DELETE = 'canvas:delete',
  CANVAS_SWITCH = 'canvas:switch',
}

export enum WebSocketResponseEvents {
  CONNECTION_READY = 'connection:ready',
  POD_CREATED = 'pod:created',
  POD_LIST_RESULT = 'pod:list:result',
  POD_GET_RESULT = 'pod:get:result',
  POD_UPDATED = 'pod:updated',
  POD_DELETED = 'pod:deleted',
  POD_CLAUDE_CHAT_MESSAGE = 'pod:claude:chat:message',
  POD_CHAT_TOOL_USE = 'pod:chat:tool_use',
  POD_CHAT_TOOL_RESULT = 'pod:chat:tool_result',
  POD_CHAT_COMPLETE = 'pod:chat:complete',
  POD_CHAT_HISTORY_RESULT = 'pod:chat:history:result',
  POD_JOINED = 'pod:joined',
  POD_JOINED_BATCH = 'pod:joined:batch',
  POD_LEFT = 'pod:left',
  POD_ERROR = 'pod:error',
  POD_STATUS_CHANGED = 'pod:status:changed',
  OUTPUT_STYLE_LIST_RESULT = 'output-style:list:result',
  OUTPUT_STYLE_CREATED = 'output-style:created',
  OUTPUT_STYLE_UPDATED = 'output-style:updated',
  OUTPUT_STYLE_READ_RESULT = 'output-style:read:result',
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
  WORKFLOW_PENDING = 'workflow:pending',
  WORKFLOW_SOURCES_MERGED = 'workflow:sources-merged',
  WORKFLOW_GET_DOWNSTREAM_PODS_RESULT = 'workflow:get-downstream-pods:result',
  WORKFLOW_CLEAR_RESULT = 'workflow:clear:result',
  CANVAS_PASTE_RESULT = 'canvas:paste:result',
  REPOSITORY_LIST_RESULT = 'repository:list:result',
  REPOSITORY_CREATED = 'repository:created',
  REPOSITORY_NOTE_CREATED = 'repository-note:created',
  REPOSITORY_NOTE_LIST_RESULT = 'repository-note:list:result',
  REPOSITORY_NOTE_UPDATED = 'repository-note:updated',
  REPOSITORY_NOTE_DELETED = 'repository-note:deleted',
  POD_REPOSITORY_BOUND = 'pod:repository:bound',
  POD_REPOSITORY_UNBOUND = 'pod:repository:unbound',
  POD_MESSAGES_CLEARED = 'pod:messages:cleared',
  OUTPUT_STYLE_DELETED = 'output-style:deleted',
  SKILL_DELETED = 'skill:deleted',
  REPOSITORY_DELETED = 'repository:deleted',
  SUBAGENT_LIST_RESULT = 'subagent:list:result',
  SUBAGENT_CREATED = 'subagent:created',
  SUBAGENT_UPDATED = 'subagent:updated',
  SUBAGENT_READ_RESULT = 'subagent:read:result',
  SUBAGENT_NOTE_CREATED = 'subagent-note:created',
  SUBAGENT_NOTE_LIST_RESULT = 'subagent-note:list:result',
  SUBAGENT_NOTE_UPDATED = 'subagent-note:updated',
  SUBAGENT_NOTE_DELETED = 'subagent-note:deleted',
  POD_SUBAGENT_BOUND = 'pod:subagent:bound',
  SUBAGENT_DELETED = 'subagent:deleted',
  POD_AUTO_CLEAR_SET = 'pod:auto-clear:set',
  WORKFLOW_AUTO_CLEARED = 'workflow:auto-cleared',
  COMMAND_LIST_RESULT = 'command:list:result',
  COMMAND_CREATED = 'command:created',
  COMMAND_UPDATED = 'command:updated',
  COMMAND_READ_RESULT = 'command:read:result',
  COMMAND_NOTE_CREATED = 'command-note:created',
  COMMAND_NOTE_LIST_RESULT = 'command-note:list:result',
  COMMAND_NOTE_UPDATED = 'command-note:updated',
  COMMAND_NOTE_DELETED = 'command-note:deleted',
  POD_COMMAND_BOUND = 'pod:command:bound',
  POD_COMMAND_UNBOUND = 'pod:command:unbound',
  COMMAND_DELETED = 'command:deleted',
  REPOSITORY_GIT_CLONE_PROGRESS = 'repository:git:clone:progress',
  REPOSITORY_GIT_CLONE_RESULT = 'repository:git:clone:result',
  HEARTBEAT_PING = 'heartbeat:ping',
  TRIGGER_CREATED = 'trigger:created',
  TRIGGER_LIST_RESULT = 'trigger:list:result',
  TRIGGER_UPDATED = 'trigger:updated',
  TRIGGER_DELETED = 'trigger:deleted',
  TRIGGER_FIRED = 'trigger:fired',
  CANVAS_CREATED = 'canvas:created',
  CANVAS_LIST_RESULT = 'canvas:list:result',
  CANVAS_RENAMED = 'canvas:renamed',
  CANVAS_DELETED = 'canvas:deleted',
  CANVAS_SWITCHED = 'canvas:switched',
  BROADCAST_POD_CREATED = 'broadcast:pod:created',
  BROADCAST_POD_UPDATED = 'broadcast:pod:updated',
  BROADCAST_POD_DELETED = 'broadcast:pod:deleted',
  BROADCAST_CONNECTION_CREATED = 'broadcast:connection:created',
  BROADCAST_CONNECTION_UPDATED = 'broadcast:connection:updated',
  BROADCAST_CONNECTION_DELETED = 'broadcast:connection:deleted',
  BROADCAST_TRIGGER_CREATED = 'broadcast:trigger:created',
  BROADCAST_TRIGGER_UPDATED = 'broadcast:trigger:updated',
  BROADCAST_TRIGGER_DELETED = 'broadcast:trigger:deleted',
  BROADCAST_OUTPUT_STYLE_CREATED = 'broadcast:output-style:created',
  BROADCAST_OUTPUT_STYLE_UPDATED = 'broadcast:output-style:updated',
  BROADCAST_OUTPUT_STYLE_DELETED = 'broadcast:output-style:deleted',
  BROADCAST_NOTE_CREATED = 'broadcast:note:created',
  BROADCAST_NOTE_UPDATED = 'broadcast:note:updated',
  BROADCAST_NOTE_DELETED = 'broadcast:note:deleted',
  BROADCAST_SKILL_NOTE_CREATED = 'broadcast:skill-note:created',
  BROADCAST_SKILL_NOTE_UPDATED = 'broadcast:skill-note:updated',
  BROADCAST_SKILL_NOTE_DELETED = 'broadcast:skill-note:deleted',
  BROADCAST_REPOSITORY_NOTE_CREATED = 'broadcast:repository-note:created',
  BROADCAST_REPOSITORY_NOTE_UPDATED = 'broadcast:repository-note:updated',
  BROADCAST_REPOSITORY_NOTE_DELETED = 'broadcast:repository-note:deleted',
  BROADCAST_SUBAGENT_NOTE_CREATED = 'broadcast:subagent-note:created',
  BROADCAST_SUBAGENT_NOTE_UPDATED = 'broadcast:subagent-note:updated',
  BROADCAST_SUBAGENT_NOTE_DELETED = 'broadcast:subagent-note:deleted',
  BROADCAST_COMMAND_NOTE_CREATED = 'broadcast:command-note:created',
  BROADCAST_COMMAND_NOTE_UPDATED = 'broadcast:command-note:updated',
  BROADCAST_COMMAND_NOTE_DELETED = 'broadcast:command-note:deleted',
  BROADCAST_SKILL_DELETED = 'broadcast:skill:deleted',
  BROADCAST_REPOSITORY_CREATED = 'broadcast:repository:created',
  BROADCAST_REPOSITORY_DELETED = 'broadcast:repository:deleted',
  BROADCAST_SUBAGENT_CREATED = 'broadcast:subagent:created',
  BROADCAST_SUBAGENT_UPDATED = 'broadcast:subagent:updated',
  BROADCAST_SUBAGENT_DELETED = 'broadcast:subagent:deleted',
  BROADCAST_COMMAND_CREATED = 'broadcast:command:created',
  BROADCAST_COMMAND_UPDATED = 'broadcast:command:updated',
  BROADCAST_COMMAND_DELETED = 'broadcast:command:deleted',
  BROADCAST_POD_OUTPUT_STYLE_BOUND = 'broadcast:pod:output-style:bound',
  BROADCAST_POD_OUTPUT_STYLE_UNBOUND = 'broadcast:pod:output-style:unbound',
  BROADCAST_POD_SKILL_BOUND = 'broadcast:pod:skill:bound',
  BROADCAST_POD_REPOSITORY_BOUND = 'broadcast:pod:repository:bound',
  BROADCAST_POD_REPOSITORY_UNBOUND = 'broadcast:pod:repository:unbound',
  BROADCAST_POD_SUBAGENT_BOUND = 'broadcast:pod:subagent:bound',
  BROADCAST_POD_COMMAND_BOUND = 'broadcast:pod:command:bound',
  BROADCAST_POD_COMMAND_UNBOUND = 'broadcast:pod:command:unbound',
  BROADCAST_POD_AUTO_CLEAR_SET = 'broadcast:pod:auto-clear:set',
  BROADCAST_CANVAS_RENAMED = 'broadcast:canvas:renamed',
  BROADCAST_CANVAS_DELETED = 'broadcast:canvas:deleted',
  BROADCAST_CANVAS_PASTED = 'broadcast:canvas:pasted',
  BROADCAST_WORKFLOW_CLEAR_RESULT = 'broadcast:workflow:clear:result',
  BROADCAST_POD_CHAT_USER_MESSAGE = 'broadcast:pod:chat:user-message',
}

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

export interface PodStatusChangedPayload {
  podId: string;
  status: import('./pod.js').PodStatus;
  previousStatus: import('./pod.js').PodStatus;
}

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

export interface NoteCreatePayload {
  requestId: string;
  canvasId: string;
  outputStyleId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface NoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface NoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface NoteDeletePayload {
  requestId: string;
  canvasId: string;
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
  canvasId: string;
}

export interface SkillNoteCreatePayload {
  requestId: string;
  canvasId: string;
  skillId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface SkillNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface SkillNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface SkillNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface PodBindSkillPayload {
  requestId: string;
  canvasId: string;
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
  canvasId: string;
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
  canvasId: string;
}

export interface ConnectionListResultPayload {
  requestId: string;
  success: boolean;
  connections?: import('./connection.js').Connection[];
  error?: string;
}

export interface ConnectionDeletePayload {
  requestId: string;
  canvasId: string;
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
  canvasId: string;
  connectionId: string;
  autoTrigger?: boolean;
}

export interface ConnectionUpdatedPayload {
  requestId: string;
  success: boolean;
  connection?: import('./connection.js').Connection;
  error?: string;
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

export interface WorkflowPendingPayload {
  targetPodId: string;
  completedSourcePodIds: string[];
  pendingSourcePodIds: string[];
  totalSources: number;
  completedCount: number;
}

export interface WorkflowSourcesMergedPayload {
  targetPodId: string;
  sourcePodIds: string[];
  mergedContentPreview: string;
}

export interface WorkflowGetDownstreamPodsPayload {
  requestId: string;
  canvasId: string;
  sourcePodId: string;
}

export interface WorkflowGetDownstreamPodsResultPayload {
  requestId: string;
  success: boolean;
  pods?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface WorkflowClearPayload {
  requestId: string;
  canvasId: string;
  sourcePodId: string;
}

export interface WorkflowClearResultPayload {
  requestId: string;
  success: boolean;
  clearedPodIds?: string[];
  clearedPodNames?: string[];
  error?: string;
}

export interface PastePodItem {
  originalId: string;
  name: string;
  color: PodColor;
  x: number;
  y: number;
  rotation: number;
  outputStyleId?: string | null;
  skillIds?: string[];
  subAgentIds?: string[];
  model?: ModelType;
  repositoryId?: string | null;
  commandId?: string | null;
}

interface PasteNoteItemBase {
  name: string;
  x: number;
  y: number;
  boundToOriginalPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface PasteOutputStyleNoteItem extends PasteNoteItemBase {
  outputStyleId: string;
}

export interface PasteSkillNoteItem extends PasteNoteItemBase {
  skillId: string;
}

export interface PasteRepositoryNoteItem extends PasteNoteItemBase {
  repositoryId: string;
}

export interface PasteSubAgentNoteItem extends PasteNoteItemBase {
  subAgentId: string;
}

export interface PasteCommandNoteItem extends PasteNoteItemBase {
  commandId: string;
}

export interface PasteConnectionItem {
  originalSourcePodId: string;
  sourceAnchor: import('./connection.js').AnchorPosition;
  originalTargetPodId: string;
  targetAnchor: import('./connection.js').AnchorPosition;
  autoTrigger?: boolean;
}

export interface CanvasPastePayload {
  requestId: string;
  canvasId: string;
  pods: PastePodItem[];
  outputStyleNotes: PasteOutputStyleNoteItem[];
  skillNotes: PasteSkillNoteItem[];
  repositoryNotes: PasteRepositoryNoteItem[];
  subAgentNotes: PasteSubAgentNoteItem[];
  commandNotes: PasteCommandNoteItem[];
  connections: PasteConnectionItem[];
}

export interface PasteError {
  type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote';
  originalId: string;
  error: string;
}

export interface CanvasPasteResultPayload {
  requestId: string;
  success: boolean;
  createdPods: Pod[];
  createdOutputStyleNotes: import('./outputStyleNote.js').OutputStyleNote[];
  createdSkillNotes: import('./skillNote.js').SkillNote[];
  createdRepositoryNotes: import('./repositoryNote.js').RepositoryNote[];
  createdSubAgentNotes: import('./subAgentNote.js').SubAgentNote[];
  createdCommandNotes: import('./commandNote.js').CommandNote[];
  createdConnections: import('./connection.js').Connection[];
  podIdMapping: Record<string, string>;
  errors: PasteError[];
  error?: string;
}

export interface RepositoryListPayload {
  requestId: string;
  canvasId: string;
}

export interface RepositoryListResultPayload {
  requestId: string;
  success: boolean;
  repositories?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface RepositoryCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
}

export interface RepositoryCreatedPayload {
  requestId: string;
  success: boolean;
  repository?: { id: string; name: string };
  error?: string;
}

export interface RepositoryNoteCreatePayload {
  requestId: string;
  canvasId: string;
  repositoryId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface RepositoryNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./repositoryNote.js').RepositoryNote;
  error?: string;
}

export interface RepositoryNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface RepositoryNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./repositoryNote.js').RepositoryNote[];
  error?: string;
}

export interface RepositoryNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface RepositoryNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./repositoryNote.js').RepositoryNote;
  error?: string;
}

export interface RepositoryNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface RepositoryNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
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

export interface PodMessagesClearedPayload {
  podId: string;
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

export interface SkillDeletePayload {
  requestId: string;
  canvasId: string;
  skillId: string;
}

export interface SkillDeletedPayload {
  requestId: string;
  success: boolean;
  skillId?: string;
  deletedNoteIds?: string[];
  error?: string;
}

export interface RepositoryDeletePayload {
  requestId: string;
  canvasId: string;
  repositoryId: string;
}

export interface RepositoryDeletedPayload {
  requestId: string;
  success: boolean;
  repositoryId?: string;
  deletedNoteIds?: string[];
  error?: string;
}

export interface SubAgentListPayload {
  requestId: string;
  canvasId: string;
}

export interface SubAgentListResultPayload {
  requestId: string;
  success: boolean;
  subAgents?: import('./subAgent.js').SubAgent[];
  error?: string;
}

export interface SubAgentCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  content: string;
}

export interface SubAgentCreatedPayload {
  requestId: string;
  success: boolean;
  subAgent?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface SubAgentUpdatePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
  content: string;
}

export interface SubAgentUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
}

export interface SubAgentReadPayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
}

export interface SubAgentReadResultPayload {
  requestId: string;
  success: boolean;
  subAgent?: {
    id: string;
    name: string;
    content: string;
  };
  error?: string;
}

export interface SubAgentNoteCreatePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface SubAgentNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./subAgentNote.js').SubAgentNote;
  error?: string;
}

export interface SubAgentNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface SubAgentNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./subAgentNote.js').SubAgentNote[];
  error?: string;
}

export interface SubAgentNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface SubAgentNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./subAgentNote.js').SubAgentNote;
  error?: string;
}

export interface SubAgentNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface SubAgentNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
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

export interface SubAgentDeletePayload {
  requestId: string;
  canvasId: string;
  subAgentId: string;
}

export interface SubAgentDeletedPayload {
  requestId: string;
  success: boolean;
  subAgentId?: string;
  deletedNoteIds?: string[];
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

export interface WorkflowAutoClearedPayload {
  sourcePodId: string;
  clearedPodIds: string[];
  clearedPodNames: string[];
}

export interface CommandListPayload {
  requestId: string;
  canvasId: string;
}

export interface CommandListResultPayload {
  requestId: string;
  success: boolean;
  commands?: import('./command.js').Command[];
  error?: string;
}

export interface CommandCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  content: string;
}

export interface CommandCreatedPayload {
  requestId: string;
  success: boolean;
  command?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface CommandUpdatePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
  content: string;
}

export interface CommandUpdatedPayload {
  requestId: string;
  success: boolean;
  error?: string;
}

export interface CommandReadPayload {
  requestId: string;
  canvasId: string;
  commandId: string;
}

export interface CommandReadResultPayload {
  requestId: string;
  success: boolean;
  command?: {
    id: string;
    name: string;
    content: string;
  };
  error?: string;
}

export interface CommandNoteCreatePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface CommandNoteCreatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./commandNote.js').CommandNote;
  error?: string;
}

export interface CommandNoteListPayload {
  requestId: string;
  canvasId: string;
}

export interface CommandNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./commandNote.js').CommandNote[];
  error?: string;
}

export interface CommandNoteUpdatePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
  x?: number;
  y?: number;
  boundToPodId?: string | null;
  originalPosition?: { x: number; y: number } | null;
}

export interface CommandNoteUpdatedPayload {
  requestId: string;
  success: boolean;
  note?: import('./commandNote.js').CommandNote;
  error?: string;
}

export interface CommandNoteDeletePayload {
  requestId: string;
  canvasId: string;
  noteId: string;
}

export interface CommandNoteDeletedPayload {
  requestId: string;
  success: boolean;
  noteId?: string;
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

export interface CommandDeletePayload {
  requestId: string;
  canvasId: string;
  commandId: string;
}

export interface CommandDeletedPayload {
  requestId: string;
  success: boolean;
  commandId?: string;
  deletedNoteIds?: string[];
  error?: string;
}

export interface RepositoryGitCloneProgressPayload {
  requestId: string;
  progress: number;
  message: string;
}

export interface RepositoryGitCloneResultPayload {
  requestId: string;
  success: boolean;
  repository?: { id: string; name: string };
  error?: string;
}

export interface TriggerCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  type: 'time';
  config: import('./trigger.js').TimeTriggerConfig;
  x: number;
  y: number;
  rotation: number;
  enabled: boolean;
}

export interface TriggerListPayload {
  requestId: string;
  canvasId: string;
}

export interface TriggerUpdatePayload {
  requestId: string;
  canvasId: string;
  triggerId: string;
  name?: string;
  type?: 'time';
  config?: import('./trigger.js').TimeTriggerConfig;
  x?: number;
  y?: number;
  rotation?: number;
  enabled?: boolean;
}

export interface TriggerDeletePayload {
  requestId: string;
  canvasId: string;
  triggerId: string;
}

export interface TriggerCreatedPayload {
  requestId: string;
  success: boolean;
  trigger?: import('./trigger.js').Trigger;
  error?: string;
}

export interface TriggerListResultPayload {
  requestId: string;
  success: boolean;
  triggers?: import('./trigger.js').Trigger[];
  error?: string;
}

export interface TriggerUpdatedPayload {
  requestId: string;
  success: boolean;
  trigger?: import('./trigger.js').Trigger;
  error?: string;
}

export interface TriggerDeletedPayload {
  requestId: string;
  success: boolean;
  triggerId?: string;
  deletedConnectionIds?: string[];
  error?: string;
}

export interface TriggerFiredPayload {
  triggerId: string;
  timestamp: string;
  firedPodIds: string[];
  skippedPodIds: string[];
}

export interface CanvasCreatePayload {
  requestId: string;
  name: string;
}

export interface CanvasListPayload {
  requestId: string;
}

export interface CanvasRenamePayload {
  requestId: string;
  canvasId: string;
  newName: string;
}

export interface CanvasDeletePayload {
  requestId: string;
  canvasId: string;
}

export interface CanvasSwitchPayload {
  requestId: string;
  canvasId: string;
}

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

// Broadcast Payload Interfaces
export interface BroadcastPodCreatedPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodUpdatedPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodDeletedPayload {
  canvasId: string;
  podId: string;
}

export interface BroadcastConnectionCreatedPayload {
  canvasId: string;
  connection: import('./connection.js').Connection;
}

export interface BroadcastConnectionUpdatedPayload {
  canvasId: string;
  connection: import('./connection.js').Connection;
}

export interface BroadcastConnectionDeletedPayload {
  canvasId: string;
  connectionId: string;
}

export interface BroadcastTriggerCreatedPayload {
  canvasId: string;
  trigger: import('./trigger.js').Trigger;
}

export interface BroadcastTriggerUpdatedPayload {
  canvasId: string;
  trigger: import('./trigger.js').Trigger;
}

export interface BroadcastTriggerDeletedPayload {
  canvasId: string;
  triggerId: string;
  deletedConnectionIds: string[];
}

export interface BroadcastOutputStyleCreatedPayload {
  canvasId: string;
  outputStyle: {
    id: string;
    name: string;
  };
}

export interface BroadcastOutputStyleUpdatedPayload {
  canvasId: string;
  outputStyleId: string;
}

export interface BroadcastOutputStyleDeletedPayload {
  canvasId: string;
  outputStyleId: string;
  deletedNoteIds: string[];
}

export interface BroadcastNoteCreatedPayload {
  canvasId: string;
  note: import('./outputStyleNote.js').OutputStyleNote;
}

export interface BroadcastNoteUpdatedPayload {
  canvasId: string;
  note: import('./outputStyleNote.js').OutputStyleNote;
}

export interface BroadcastNoteDeletedPayload {
  canvasId: string;
  noteId: string;
}

export interface BroadcastSkillNoteCreatedPayload {
  canvasId: string;
  note: import('./skillNote.js').SkillNote;
}

export interface BroadcastSkillNoteUpdatedPayload {
  canvasId: string;
  note: import('./skillNote.js').SkillNote;
}

export interface BroadcastSkillNoteDeletedPayload {
  canvasId: string;
  noteId: string;
}

export interface BroadcastRepositoryNoteCreatedPayload {
  canvasId: string;
  note: import('./repositoryNote.js').RepositoryNote;
}

export interface BroadcastRepositoryNoteUpdatedPayload {
  canvasId: string;
  note: import('./repositoryNote.js').RepositoryNote;
}

export interface BroadcastRepositoryNoteDeletedPayload {
  canvasId: string;
  noteId: string;
}

export interface BroadcastSubAgentNoteCreatedPayload {
  canvasId: string;
  note: import('./subAgentNote.js').SubAgentNote;
}

export interface BroadcastSubAgentNoteUpdatedPayload {
  canvasId: string;
  note: import('./subAgentNote.js').SubAgentNote;
}

export interface BroadcastSubAgentNoteDeletedPayload {
  canvasId: string;
  noteId: string;
}

export interface BroadcastCommandNoteCreatedPayload {
  canvasId: string;
  note: import('./commandNote.js').CommandNote;
}

export interface BroadcastCommandNoteUpdatedPayload {
  canvasId: string;
  note: import('./commandNote.js').CommandNote;
}

export interface BroadcastCommandNoteDeletedPayload {
  canvasId: string;
  noteId: string;
}

export interface BroadcastSkillDeletedPayload {
  canvasId: string;
  skillId: string;
  deletedNoteIds: string[];
}

export interface BroadcastRepositoryCreatedPayload {
  canvasId: string;
  repository: {
    id: string;
    name: string;
  };
}

export interface BroadcastRepositoryDeletedPayload {
  canvasId: string;
  repositoryId: string;
  deletedNoteIds: string[];
}

export interface BroadcastSubAgentCreatedPayload {
  canvasId: string;
  subAgent: {
    id: string;
    name: string;
  };
}

export interface BroadcastSubAgentUpdatedPayload {
  canvasId: string;
  subAgentId: string;
}

export interface BroadcastSubAgentDeletedPayload {
  canvasId: string;
  subAgentId: string;
  deletedNoteIds: string[];
}

export interface BroadcastCommandCreatedPayload {
  canvasId: string;
  command: {
    id: string;
    name: string;
  };
}

export interface BroadcastCommandUpdatedPayload {
  canvasId: string;
  commandId: string;
}

export interface BroadcastCommandDeletedPayload {
  canvasId: string;
  commandId: string;
  deletedNoteIds: string[];
}

export interface BroadcastPodOutputStyleBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodOutputStyleUnboundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodSkillBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodRepositoryBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodRepositoryUnboundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodSubAgentBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodCommandBoundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodCommandUnboundPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastPodAutoClearSetPayload {
  canvasId: string;
  pod: Pod;
}

export interface BroadcastCanvasRenamedPayload {
  canvasId: string;
  newName: string;
}

export interface BroadcastCanvasDeletedPayload {
  canvasId: string;
}

export interface BroadcastCanvasPastedPayload {
  canvasId: string;
  createdPods: Pod[];
  createdOutputStyleNotes: import('./outputStyleNote.js').OutputStyleNote[];
  createdSkillNotes: import('./skillNote.js').SkillNote[];
  createdRepositoryNotes: import('./repositoryNote.js').RepositoryNote[];
  createdSubAgentNotes: import('./subAgentNote.js').SubAgentNote[];
  createdCommandNotes: import('./commandNote.js').CommandNote[];
  createdConnections: import('./connection.js').Connection[];
}

export interface BroadcastWorkflowClearResultPayload {
  canvasId: string;
  clearedPodIds: string[];
}