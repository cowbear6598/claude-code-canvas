import type { Pod, PodColor, PodTypeName, ModelType } from './pod.js';

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
  SUBAGENT_NOTE_CREATE = 'subagent-note:create',
  SUBAGENT_NOTE_LIST = 'subagent-note:list',
  SUBAGENT_NOTE_UPDATE = 'subagent-note:update',
  SUBAGENT_NOTE_DELETE = 'subagent-note:delete',
  POD_BIND_SUBAGENT = 'pod:bind-subagent',
  SUBAGENT_DELETE = 'subagent:delete',
  POD_SET_AUTO_CLEAR = 'pod:set-auto-clear',
  COMMAND_LIST = 'command:list',
  COMMAND_NOTE_CREATE = 'command-note:create',
  COMMAND_NOTE_LIST = 'command-note:list',
  COMMAND_NOTE_UPDATE = 'command-note:update',
  COMMAND_NOTE_DELETE = 'command-note:delete',
  POD_BIND_COMMAND = 'pod:bind-command',
  POD_UNBIND_COMMAND = 'pod:unbind-command',
  COMMAND_DELETE = 'command:delete',
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
  POD_STATUS_CHANGED = 'pod:status:changed',
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
  SUBAGENT_NOTE_CREATED = 'subagent-note:created',
  SUBAGENT_NOTE_LIST_RESULT = 'subagent-note:list:result',
  SUBAGENT_NOTE_UPDATED = 'subagent-note:updated',
  SUBAGENT_NOTE_DELETED = 'subagent-note:deleted',
  POD_SUBAGENT_BOUND = 'pod:subagent:bound',
  SUBAGENT_DELETED = 'subagent:deleted',
  POD_AUTO_CLEAR_SET = 'pod:auto-clear:set',
  WORKFLOW_AUTO_CLEARED = 'workflow:auto-cleared',
  COMMAND_LIST_RESULT = 'command:list:result',
  COMMAND_NOTE_CREATED = 'command-note:created',
  COMMAND_NOTE_LIST_RESULT = 'command-note:list:result',
  COMMAND_NOTE_UPDATED = 'command-note:updated',
  COMMAND_NOTE_DELETED = 'command-note:deleted',
  POD_COMMAND_BOUND = 'pod:command:bound',
  POD_COMMAND_UNBOUND = 'pod:command:unbound',
  COMMAND_DELETED = 'command:deleted',
  HEARTBEAT_PING = 'heartbeat:ping',
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
  model?: ModelType;
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
    role: 'user' | 'assistant';
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
  type: PodTypeName;
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
}

export interface RepositoryListResultPayload {
  requestId: string;
  success: boolean;
  repositories?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface RepositoryCreatePayload {
  requestId: string;
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
}

export interface RepositoryNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./repositoryNote.js').RepositoryNote[];
  error?: string;
}

export interface RepositoryNoteUpdatePayload {
  requestId: string;
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
}

export interface SubAgentListResultPayload {
  requestId: string;
  success: boolean;
  subAgents?: import('./subAgent.js').SubAgent[];
  error?: string;
}

export interface SubAgentNoteCreatePayload {
  requestId: string;
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
}

export interface SubAgentNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./subAgentNote.js').SubAgentNote[];
  error?: string;
}

export interface SubAgentNoteUpdatePayload {
  requestId: string;
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
}

export interface CommandListResultPayload {
  requestId: string;
  success: boolean;
  commands?: import('./command.js').Command[];
  error?: string;
}

export interface CommandNoteCreatePayload {
  requestId: string;
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
}

export interface CommandNoteListResultPayload {
  requestId: string;
  success: boolean;
  notes?: import('./commandNote.js').CommandNote[];
  error?: string;
}

export interface CommandNoteUpdatePayload {
  requestId: string;
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
  commandId: string;
}

export interface CommandDeletedPayload {
  requestId: string;
  success: boolean;
  commandId?: string;
  deletedNoteIds?: string[];
  error?: string;
}
