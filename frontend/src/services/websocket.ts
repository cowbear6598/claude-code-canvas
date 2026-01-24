import { io, Socket } from 'socket.io-client'
import { ref, computed } from 'vue'
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents
} from '@/types/websocket'
import type {
  PodCreatePayload,
  PodListPayload,
  PodGetPayload,
  PodUpdatePayload,
  PodDeletePayload,
  PodGitClonePayload,
  PodChatSendPayload,
  PodChatHistoryPayload,
  PodJoinPayload,
  PodJoinBatchPayload,
  PodLeavePayload,
  OutputStyleListPayload,
  PodBindOutputStylePayload,
  PodUnbindOutputStylePayload,
  ConnectionReadyPayload,
  PodCreatedPayload,
  PodListResultPayload,
  PodGetResultPayload,
  PodUpdatedPayload,
  PodDeletedPayload,
  PodGitCloneProgressPayload,
  PodGitCloneResultPayload,
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodChatHistoryResultPayload,
  PodJoinedPayload,
  PodJoinedBatchPayload,
  PodLeftPayload,
  PodErrorPayload,
  OutputStyleListResultPayload,
  PodOutputStyleBoundPayload,
  PodOutputStyleUnboundPayload,
  NoteCreatePayload,
  NoteListPayload,
  NoteUpdatePayload,
  NoteDeletePayload,
  NoteCreatedPayload,
  NoteListResultPayload,
  NoteUpdatedPayload,
  NoteDeletedPayload,
  SkillListPayload,
  SkillNoteCreatePayload,
  SkillNoteListPayload,
  SkillNoteUpdatePayload,
  SkillNoteDeletePayload,
  PodBindSkillPayload,
  SkillListResultPayload,
  SkillNoteCreatedPayload,
  SkillNoteListResultPayload,
  SkillNoteUpdatedPayload,
  SkillNoteDeletedPayload,
  PodSkillBoundPayload,
  ConnectionCreatePayload,
  ConnectionListPayload,
  ConnectionDeletePayload,
  ConnectionUpdatePayload,
  ConnectionCreatedPayload,
  ConnectionListResultPayload,
  ConnectionDeletedPayload,
  ConnectionUpdatedPayload,
  WorkflowTriggerPayload,
  WorkflowTriggeredPayload,
  WorkflowCompletePayload,
  WorkflowErrorPayload,
  WorkflowAutoTriggeredPayload
} from '@/types/websocket'

type EventCallback<T> = (payload: T) => void

const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MS: 1000,
} as const

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS
  private readonly reconnectDelay = WS_CONFIG.RECONNECT_DELAY_MS

  public readonly socketId = ref<string | null>(null)
  public readonly isConnected = computed(() => this.socket?.connected ?? false)

  connect(url?: string): void {
    if (this.socket?.connected) {
      return
    }

    const wsUrl = url || import.meta.env.VITE_WS_URL || 'http://localhost:3001'

    this.socket = io(wsUrl, {
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    })

    this.setupConnectionHandlers()
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.socketId.value = null
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (_) => {
      this.socketId.value = null
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached')
      }
    })

    this.socket.on('reconnect', (_) => {
      this.reconnectAttempts = 0
    })

    this.socket.on('reconnect_attempt', (_) => {
      // Reconnection attempt
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('[WebSocket] Reconnection error:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed')
    })
  }

  podCreate(payload: PodCreatePayload): void {
    this.emit(WebSocketRequestEvents.POD_CREATE, payload)
  }

  podList(payload: PodListPayload): void {
    this.emit(WebSocketRequestEvents.POD_LIST, payload)
  }

  podGet(payload: PodGetPayload): void {
    this.emit(WebSocketRequestEvents.POD_GET, payload)
  }

  podUpdate(payload: PodUpdatePayload): void {
    this.emit(WebSocketRequestEvents.POD_UPDATE, payload)
  }

  podDelete(payload: PodDeletePayload): void {
    this.emit(WebSocketRequestEvents.POD_DELETE, payload)
  }

  podGitClone(payload: PodGitClonePayload): void {
    this.emit(WebSocketRequestEvents.POD_GIT_CLONE, payload)
  }

  podChatSend(payload: PodChatSendPayload): void {
    this.emit(WebSocketRequestEvents.POD_CHAT_SEND, payload)
  }

  podChatHistory(payload: PodChatHistoryPayload): void {
    this.emit(WebSocketRequestEvents.POD_CHAT_HISTORY, payload)
  }

  podJoin(payload: PodJoinPayload): void {
    this.emit(WebSocketRequestEvents.POD_JOIN, payload)
  }

  podJoinBatch(payload: PodJoinBatchPayload): void {
    this.emit(WebSocketRequestEvents.POD_JOIN_BATCH, payload)
  }

  podLeave(payload: PodLeavePayload): void {
    this.emit(WebSocketRequestEvents.POD_LEAVE, payload)
  }

  outputStyleList(payload: OutputStyleListPayload): void {
    this.emit(WebSocketRequestEvents.OUTPUT_STYLE_LIST, payload)
  }

  podBindOutputStyle(payload: PodBindOutputStylePayload): void {
    this.emit(WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE, payload)
  }

  podUnbindOutputStyle(payload: PodUnbindOutputStylePayload): void {
    this.emit(WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE, payload)
  }

  noteCreate(payload: NoteCreatePayload): void {
    this.emit(WebSocketRequestEvents.NOTE_CREATE, payload)
  }

  noteList(payload: NoteListPayload): void {
    this.emit(WebSocketRequestEvents.NOTE_LIST, payload)
  }

  noteUpdate(payload: NoteUpdatePayload): void {
    this.emit(WebSocketRequestEvents.NOTE_UPDATE, payload)
  }

  noteDelete(payload: NoteDeletePayload): void {
    this.emit(WebSocketRequestEvents.NOTE_DELETE, payload)
  }

  skillList(payload: SkillListPayload): void {
    this.emit(WebSocketRequestEvents.SKILL_LIST, payload)
  }

  skillNoteCreate(payload: SkillNoteCreatePayload): void {
    this.emit(WebSocketRequestEvents.SKILL_NOTE_CREATE, payload)
  }

  skillNoteList(payload: SkillNoteListPayload): void {
    this.emit(WebSocketRequestEvents.SKILL_NOTE_LIST, payload)
  }

  skillNoteUpdate(payload: SkillNoteUpdatePayload): void {
    this.emit(WebSocketRequestEvents.SKILL_NOTE_UPDATE, payload)
  }

  skillNoteDelete(payload: SkillNoteDeletePayload): void {
    this.emit(WebSocketRequestEvents.SKILL_NOTE_DELETE, payload)
  }

  podBindSkill(payload: PodBindSkillPayload): void {
    this.emit(WebSocketRequestEvents.POD_BIND_SKILL, payload)
  }

  connectionCreate(payload: ConnectionCreatePayload): void {
    this.emit(WebSocketRequestEvents.CONNECTION_CREATE, payload)
  }

  connectionList(payload: ConnectionListPayload): void {
    this.emit(WebSocketRequestEvents.CONNECTION_LIST, payload)
  }

  connectionDelete(payload: ConnectionDeletePayload): void {
    this.emit(WebSocketRequestEvents.CONNECTION_DELETE, payload)
  }

  connectionUpdate(payload: ConnectionUpdatePayload): void {
    this.emit(WebSocketRequestEvents.CONNECTION_UPDATE, payload)
  }

  workflowTrigger(payload: WorkflowTriggerPayload): void {
    this.emit(WebSocketRequestEvents.WORKFLOW_TRIGGER, payload)
  }

  onConnectionReady(callback: EventCallback<ConnectionReadyPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_READY, callback)
  }

  onPodCreated(callback: EventCallback<PodCreatedPayload>): void {
    this.on(WebSocketResponseEvents.POD_CREATED, callback)
  }

  onPodListResult(callback: EventCallback<PodListResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_LIST_RESULT, callback)
  }

  onPodGetResult(callback: EventCallback<PodGetResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_GET_RESULT, callback)
  }

  onPodUpdated(callback: EventCallback<PodUpdatedPayload>): void {
    this.on(WebSocketResponseEvents.POD_UPDATED, callback)
  }

  onPodDeleted(callback: EventCallback<PodDeletedPayload>): void {
    this.on(WebSocketResponseEvents.POD_DELETED, callback)
  }

  onGitCloneProgress(callback: EventCallback<PodGitCloneProgressPayload>): void {
    this.on(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, callback)
  }

  onGitCloneResult(callback: EventCallback<PodGitCloneResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_GIT_CLONE_RESULT, callback)
  }

  onChatMessage(callback: EventCallback<PodChatMessagePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_MESSAGE, callback)
  }

  onChatToolUse(callback: EventCallback<PodChatToolUsePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_TOOL_USE, callback)
  }

  onChatToolResult(callback: EventCallback<PodChatToolResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, callback)
  }

  onChatComplete(callback: EventCallback<PodChatCompletePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_COMPLETE, callback)
  }

  onChatHistoryResult(callback: EventCallback<PodChatHistoryResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, callback)
  }

  onPodJoined(callback: EventCallback<PodJoinedPayload>): void {
    this.on(WebSocketResponseEvents.POD_JOINED, callback)
  }

  onPodJoinedBatch(callback: EventCallback<PodJoinedBatchPayload>): void {
    this.on(WebSocketResponseEvents.POD_JOINED_BATCH, callback)
  }

  onPodLeft(callback: EventCallback<PodLeftPayload>): void {
    this.on(WebSocketResponseEvents.POD_LEFT, callback)
  }

  onError(callback: EventCallback<PodErrorPayload>): void {
    this.on(WebSocketResponseEvents.POD_ERROR, callback)
  }

  onOutputStyleListResult(callback: EventCallback<OutputStyleListResultPayload>): void {
    this.on(WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, callback)
  }

  onPodOutputStyleBound(callback: EventCallback<PodOutputStyleBoundPayload>): void {
    this.on(WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, callback)
  }

  onPodOutputStyleUnbound(callback: EventCallback<PodOutputStyleUnboundPayload>): void {
    this.on(WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, callback)
  }

  onNoteCreated(callback: EventCallback<NoteCreatedPayload>): void {
    this.on(WebSocketResponseEvents.NOTE_CREATED, callback)
  }

  onNoteListResult(callback: EventCallback<NoteListResultPayload>): void {
    this.on(WebSocketResponseEvents.NOTE_LIST_RESULT, callback)
  }

  onNoteUpdated(callback: EventCallback<NoteUpdatedPayload>): void {
    this.on(WebSocketResponseEvents.NOTE_UPDATED, callback)
  }

  onNoteDeleted(callback: EventCallback<NoteDeletedPayload>): void {
    this.on(WebSocketResponseEvents.NOTE_DELETED, callback)
  }

  onSkillListResult(callback: EventCallback<SkillListResultPayload>): void {
    this.on(WebSocketResponseEvents.SKILL_LIST_RESULT, callback)
  }

  onSkillNoteCreated(callback: EventCallback<SkillNoteCreatedPayload>): void {
    this.on(WebSocketResponseEvents.SKILL_NOTE_CREATED, callback)
  }

  onSkillNoteListResult(callback: EventCallback<SkillNoteListResultPayload>): void {
    this.on(WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, callback)
  }

  onSkillNoteUpdated(callback: EventCallback<SkillNoteUpdatedPayload>): void {
    this.on(WebSocketResponseEvents.SKILL_NOTE_UPDATED, callback)
  }

  onSkillNoteDeleted(callback: EventCallback<SkillNoteDeletedPayload>): void {
    this.on(WebSocketResponseEvents.SKILL_NOTE_DELETED, callback)
  }

  onPodSkillBound(callback: EventCallback<PodSkillBoundPayload>): void {
    this.on(WebSocketResponseEvents.POD_SKILL_BOUND, callback)
  }

  onConnectionCreated(callback: EventCallback<ConnectionCreatedPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_CREATED, callback)
  }

  onConnectionListResult(callback: EventCallback<ConnectionListResultPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_LIST_RESULT, callback)
  }

  onConnectionDeleted(callback: EventCallback<ConnectionDeletedPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_DELETED, callback)
  }

  onConnectionUpdated(callback: EventCallback<ConnectionUpdatedPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_UPDATED, callback)
  }

  onWorkflowTriggered(callback: EventCallback<WorkflowTriggeredPayload>): void {
    this.on(WebSocketResponseEvents.WORKFLOW_TRIGGERED, callback)
  }

  onWorkflowAutoTriggered(callback: EventCallback<WorkflowAutoTriggeredPayload>): void {
    this.on(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, callback)
  }

  onWorkflowComplete(callback: EventCallback<WorkflowCompletePayload>): void {
    this.on(WebSocketResponseEvents.WORKFLOW_COMPLETE, callback)
  }

  onWorkflowError(callback: EventCallback<WorkflowErrorPayload>): void {
    this.on(WebSocketResponseEvents.WORKFLOW_ERROR, callback)
  }

  offConnectionReady(callback: EventCallback<ConnectionReadyPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_READY, callback)
  }

  offPodCreated(callback: EventCallback<PodCreatedPayload>): void {
    this.off(WebSocketResponseEvents.POD_CREATED, callback)
  }

  offPodListResult(callback: EventCallback<PodListResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_LIST_RESULT, callback)
  }

  offPodUpdated(callback: EventCallback<PodUpdatedPayload>): void {
    this.off(WebSocketResponseEvents.POD_UPDATED, callback)
  }

  offPodDeleted(callback: EventCallback<PodDeletedPayload>): void {
    this.off(WebSocketResponseEvents.POD_DELETED, callback)
  }

  offGitCloneProgress(callback: EventCallback<PodGitCloneProgressPayload>): void {
    this.off(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, callback)
  }

  offGitCloneResult(callback: EventCallback<PodGitCloneResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_GIT_CLONE_RESULT, callback)
  }

  offChatMessage(callback: EventCallback<PodChatMessagePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_MESSAGE, callback)
  }

  offChatToolUse(callback: EventCallback<PodChatToolUsePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_TOOL_USE, callback)
  }

  offChatToolResult(callback: EventCallback<PodChatToolResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, callback)
  }

  offChatComplete(callback: EventCallback<PodChatCompletePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_COMPLETE, callback)
  }

  offChatHistoryResult(callback: EventCallback<PodChatHistoryResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, callback)
  }

  offError(callback: EventCallback<PodErrorPayload>): void {
    this.off(WebSocketResponseEvents.POD_ERROR, callback)
  }

  offOutputStyleListResult(callback: EventCallback<OutputStyleListResultPayload>): void {
    this.off(WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT, callback)
  }

  offPodOutputStyleBound(callback: EventCallback<PodOutputStyleBoundPayload>): void {
    this.off(WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, callback)
  }

  offPodOutputStyleUnbound(callback: EventCallback<PodOutputStyleUnboundPayload>): void {
    this.off(WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, callback)
  }

  offNoteCreated(callback: EventCallback<NoteCreatedPayload>): void {
    this.off(WebSocketResponseEvents.NOTE_CREATED, callback)
  }

  offNoteListResult(callback: EventCallback<NoteListResultPayload>): void {
    this.off(WebSocketResponseEvents.NOTE_LIST_RESULT, callback)
  }

  offNoteUpdated(callback: EventCallback<NoteUpdatedPayload>): void {
    this.off(WebSocketResponseEvents.NOTE_UPDATED, callback)
  }

  offNoteDeleted(callback: EventCallback<NoteDeletedPayload>): void {
    this.off(WebSocketResponseEvents.NOTE_DELETED, callback)
  }

  offSkillListResult(callback: EventCallback<SkillListResultPayload>): void {
    this.off(WebSocketResponseEvents.SKILL_LIST_RESULT, callback)
  }

  offSkillNoteCreated(callback: EventCallback<SkillNoteCreatedPayload>): void {
    this.off(WebSocketResponseEvents.SKILL_NOTE_CREATED, callback)
  }

  offSkillNoteListResult(callback: EventCallback<SkillNoteListResultPayload>): void {
    this.off(WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, callback)
  }

  offSkillNoteUpdated(callback: EventCallback<SkillNoteUpdatedPayload>): void {
    this.off(WebSocketResponseEvents.SKILL_NOTE_UPDATED, callback)
  }

  offSkillNoteDeleted(callback: EventCallback<SkillNoteDeletedPayload>): void {
    this.off(WebSocketResponseEvents.SKILL_NOTE_DELETED, callback)
  }

  offPodSkillBound(callback: EventCallback<PodSkillBoundPayload>): void {
    this.off(WebSocketResponseEvents.POD_SKILL_BOUND, callback)
  }

  offPodJoinedBatch(callback: EventCallback<PodJoinedBatchPayload>): void {
    this.off(WebSocketResponseEvents.POD_JOINED_BATCH, callback)
  }

  offConnectionCreated(callback: EventCallback<ConnectionCreatedPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_CREATED, callback)
  }

  offConnectionListResult(callback: EventCallback<ConnectionListResultPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_LIST_RESULT, callback)
  }

  offConnectionDeleted(callback: EventCallback<ConnectionDeletedPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_DELETED, callback)
  }

  offConnectionUpdated(callback: EventCallback<ConnectionUpdatedPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_UPDATED, callback)
  }

  offWorkflowTriggered(callback: EventCallback<WorkflowTriggeredPayload>): void {
    this.off(WebSocketResponseEvents.WORKFLOW_TRIGGERED, callback)
  }

  offWorkflowAutoTriggered(callback: EventCallback<WorkflowAutoTriggeredPayload>): void {
    this.off(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, callback)
  }

  offWorkflowComplete(callback: EventCallback<WorkflowCompletePayload>): void {
    this.off(WebSocketResponseEvents.WORKFLOW_COMPLETE, callback)
  }

  offWorkflowError(callback: EventCallback<WorkflowErrorPayload>): void {
    this.off(WebSocketResponseEvents.WORKFLOW_ERROR, callback)
  }

  private emit(event: WebSocketRequestEvents, payload: unknown): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Cannot emit, not connected:', event)
      return
    }

    this.socket.emit(event, payload)
  }

  private on<T>(event: WebSocketResponseEvents, callback: EventCallback<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot register listener, not initialized:', event)
      return
    }

    this.socket.on(event, callback as EventCallback<unknown>)
  }

  private off<T>(event: WebSocketResponseEvents, callback: EventCallback<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot remove listener, not initialized:', event)
      return
    }

    this.socket.off(event, callback as EventCallback<unknown>)
  }
}

// Export singleton instance
export const websocketService = new WebSocketService()
