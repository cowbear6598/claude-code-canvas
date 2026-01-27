/**
 * WebSocket Event Constants
 * Centralized event name definitions for request and response events
 */

/**
 * Client -> Server Events (Request Events)
 */
export const WebSocketRequestEvents = {
  POD_CREATE: 'pod:create',
  POD_LIST: 'pod:list',
  POD_GET: 'pod:get',
  POD_UPDATE: 'pod:update',
  POD_DELETE: 'pod:delete',
  POD_GIT_CLONE: 'pod:git:clone',
  POD_CHAT_SEND: 'pod:chat:send',
  POD_CHAT_HISTORY: 'pod:chat:history',
  POD_JOIN: 'pod:join',
  POD_JOIN_BATCH: 'pod:join:batch',
  POD_LEAVE: 'pod:leave',
  OUTPUT_STYLE_LIST: 'output-style:list',
  POD_BIND_OUTPUT_STYLE: 'pod:bind-output-style',
  POD_UNBIND_OUTPUT_STYLE: 'pod:unbind-output-style',
  NOTE_CREATE: 'note:create',
  NOTE_LIST: 'note:list',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  SKILL_LIST: 'skill:list',
  SKILL_NOTE_CREATE: 'skill-note:create',
  SKILL_NOTE_LIST: 'skill-note:list',
  SKILL_NOTE_UPDATE: 'skill-note:update',
  SKILL_NOTE_DELETE: 'skill-note:delete',
  POD_BIND_SKILL: 'pod:bind-skill',
  CONNECTION_CREATE: 'connection:create',
  CONNECTION_LIST: 'connection:list',
  CONNECTION_DELETE: 'connection:delete',
  CONNECTION_UPDATE: 'connection:update',
  WORKFLOW_GET_DOWNSTREAM_PODS: 'workflow:get-downstream-pods',
  WORKFLOW_CLEAR: 'workflow:clear',
  CANVAS_PASTE: 'canvas:paste',
  // Repository Events
  REPOSITORY_LIST: 'repository:list',
  REPOSITORY_CREATE: 'repository:create',
  REPOSITORY_NOTE_CREATE: 'repository-note:create',
  REPOSITORY_NOTE_LIST: 'repository-note:list',
  REPOSITORY_NOTE_UPDATE: 'repository-note:update',
  REPOSITORY_NOTE_DELETE: 'repository-note:delete',
  POD_BIND_REPOSITORY: 'pod:bind-repository',
  POD_UNBIND_REPOSITORY: 'pod:unbind-repository',
} as const

export type WebSocketRequestEvents = typeof WebSocketRequestEvents[keyof typeof WebSocketRequestEvents]

/**
 * Server -> Client Events (Response Events)
 */
export const WebSocketResponseEvents = {
  CONNECTION_READY: 'connection:ready',
  POD_CREATED: 'pod:created',
  POD_LIST_RESULT: 'pod:list:result',
  POD_GET_RESULT: 'pod:get:result',
  POD_UPDATED: 'pod:updated',
  POD_DELETED: 'pod:deleted',
  POD_GIT_CLONE_PROGRESS: 'pod:git:clone:progress',
  POD_GIT_CLONE_RESULT: 'pod:git:clone:result',
  POD_CHAT_MESSAGE: 'pod:chat:message',
  POD_CHAT_TOOL_USE: 'pod:chat:tool_use',
  POD_CHAT_TOOL_RESULT: 'pod:chat:tool_result',
  POD_CHAT_COMPLETE: 'pod:chat:complete',
  POD_CHAT_HISTORY_RESULT: 'pod:chat:history:result',
  POD_JOINED: 'pod:joined',
  POD_JOINED_BATCH: 'pod:joined:batch',
  POD_LEFT: 'pod:left',
  POD_ERROR: 'pod:error',
  POD_STATUS_CHANGED: 'pod:status:changed',
  OUTPUT_STYLE_LIST_RESULT: 'output-style:list:result',
  POD_OUTPUT_STYLE_BOUND: 'pod:output-style:bound',
  POD_OUTPUT_STYLE_UNBOUND: 'pod:output-style:unbound',
  NOTE_CREATED: 'note:created',
  NOTE_LIST_RESULT: 'note:list:result',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  SKILL_LIST_RESULT: 'skill:list:result',
  SKILL_NOTE_CREATED: 'skill-note:created',
  SKILL_NOTE_LIST_RESULT: 'skill-note:list:result',
  SKILL_NOTE_UPDATED: 'skill-note:updated',
  SKILL_NOTE_DELETED: 'skill-note:deleted',
  POD_SKILL_BOUND: 'pod:skill:bound',
  CONNECTION_CREATED: 'connection:created',
  CONNECTION_LIST_RESULT: 'connection:list:result',
  CONNECTION_DELETED: 'connection:deleted',
  CONNECTION_UPDATED: 'connection:updated',
  WORKFLOW_TRIGGERED: 'workflow:triggered',
  WORKFLOW_COMPLETE: 'workflow:complete',
  WORKFLOW_ERROR: 'workflow:error',
  WORKFLOW_AUTO_TRIGGERED: 'workflow:auto-triggered',
  WORKFLOW_PENDING: 'workflow:pending',
  WORKFLOW_SOURCES_MERGED: 'workflow:sources-merged',
  WORKFLOW_GET_DOWNSTREAM_PODS_RESULT: 'workflow:get-downstream-pods:result',
  WORKFLOW_CLEAR_RESULT: 'workflow:clear:result',
  CANVAS_PASTE_RESULT: 'canvas:paste:result',
  // Repository Events
  REPOSITORY_LIST_RESULT: 'repository:list:result',
  REPOSITORY_CREATED: 'repository:created',
  REPOSITORY_NOTE_CREATED: 'repository-note:created',
  REPOSITORY_NOTE_LIST_RESULT: 'repository-note:list:result',
  REPOSITORY_NOTE_UPDATED: 'repository-note:updated',
  REPOSITORY_NOTE_DELETED: 'repository-note:deleted',
  POD_REPOSITORY_BOUND: 'pod:repository:bound',
  POD_REPOSITORY_UNBOUND: 'pod:repository:unbound',
  POD_MESSAGES_CLEARED: 'pod:messages:cleared',
} as const

export type WebSocketResponseEvents = typeof WebSocketResponseEvents[keyof typeof WebSocketResponseEvents]
