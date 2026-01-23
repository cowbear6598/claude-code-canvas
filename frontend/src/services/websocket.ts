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
  PodLeavePayload,
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
  PodLeftPayload,
  PodErrorPayload
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
      console.log('[WebSocket] Already connected')
      return
    }

    const wsUrl = url || import.meta.env.VITE_WS_URL || 'http://localhost:3001'

    console.log('[WebSocket] Connecting to:', wsUrl)

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
      console.log('[WebSocket] Disconnecting')
      this.socket.disconnect()
      this.socket = null
      this.socketId.value = null
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason)
      this.socketId.value = null
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached')
      }
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[WebSocket] Reconnection attempt:', attemptNumber)
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

  podLeave(payload: PodLeavePayload): void {
    this.emit(WebSocketRequestEvents.POD_LEAVE, payload)
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

  onPodLeft(callback: EventCallback<PodLeftPayload>): void {
    this.on(WebSocketResponseEvents.POD_LEFT, callback)
  }

  onError(callback: EventCallback<PodErrorPayload>): void {
    this.on(WebSocketResponseEvents.POD_ERROR, callback)
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

  private emit(event: WebSocketRequestEvents, payload: unknown): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Cannot emit, not connected:', event)
      return
    }

    if (import.meta.env.DEV) {
      console.log('[WebSocket] Emit:', event, payload)
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
