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

/**
 * WebSocket Service Configuration
 */
const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MS: 1000,
} as const

/**
 * WebSocket Service (Singleton)
 * Manages Socket.io connection lifecycle and provides typed emit/listener methods
 */
class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS
  private readonly reconnectDelay = WS_CONFIG.RECONNECT_DELAY_MS

  // Reactive state
  public readonly socketId = ref<string | null>(null)
  public readonly isConnected = computed(() => this.socket?.connected ?? false)

  /**
   * Connect to WebSocket server
   */
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

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting')
      this.socket.disconnect()
      this.socket = null
      this.socketId.value = null
    }
  }

  /**
   * Setup connection event handlers
   */
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

  // ============================================================================
  // Emit Methods (Client -> Server)
  // ============================================================================

  /**
   * Emit pod:create event
   */
  podCreate(payload: PodCreatePayload): void {
    this.emit(WebSocketRequestEvents.POD_CREATE, payload)
  }

  /**
   * Emit pod:list event
   */
  podList(payload: PodListPayload): void {
    this.emit(WebSocketRequestEvents.POD_LIST, payload)
  }

  /**
   * Emit pod:get event
   */
  podGet(payload: PodGetPayload): void {
    this.emit(WebSocketRequestEvents.POD_GET, payload)
  }

  /**
   * Emit pod:update event
   */
  podUpdate(payload: PodUpdatePayload): void {
    this.emit(WebSocketRequestEvents.POD_UPDATE, payload)
  }

  /**
   * Emit pod:delete event
   */
  podDelete(payload: PodDeletePayload): void {
    this.emit(WebSocketRequestEvents.POD_DELETE, payload)
  }

  /**
   * Emit pod:git:clone event
   */
  podGitClone(payload: PodGitClonePayload): void {
    this.emit(WebSocketRequestEvents.POD_GIT_CLONE, payload)
  }

  /**
   * Emit pod:chat:send event
   */
  podChatSend(payload: PodChatSendPayload): void {
    this.emit(WebSocketRequestEvents.POD_CHAT_SEND, payload)
  }

  /**
   * Emit pod:chat:history event
   */
  podChatHistory(payload: PodChatHistoryPayload): void {
    this.emit(WebSocketRequestEvents.POD_CHAT_HISTORY, payload)
  }

  /**
   * Emit pod:join event
   */
  podJoin(payload: PodJoinPayload): void {
    this.emit(WebSocketRequestEvents.POD_JOIN, payload)
  }

  /**
   * Emit pod:leave event
   */
  podLeave(payload: PodLeavePayload): void {
    this.emit(WebSocketRequestEvents.POD_LEAVE, payload)
  }

  // ============================================================================
  // Listener Registration Methods (Server -> Client)
  // ============================================================================

  /**
   * Listen for connection:ready event
   */
  onConnectionReady(callback: EventCallback<ConnectionReadyPayload>): void {
    this.on(WebSocketResponseEvents.CONNECTION_READY, callback)
  }

  /**
   * Listen for pod:created event
   */
  onPodCreated(callback: EventCallback<PodCreatedPayload>): void {
    this.on(WebSocketResponseEvents.POD_CREATED, callback)
  }

  /**
   * Listen for pod:list:result event
   */
  onPodListResult(callback: EventCallback<PodListResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_LIST_RESULT, callback)
  }

  /**
   * Listen for pod:get:result event
   */
  onPodGetResult(callback: EventCallback<PodGetResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_GET_RESULT, callback)
  }

  /**
   * Listen for pod:updated event
   */
  onPodUpdated(callback: EventCallback<PodUpdatedPayload>): void {
    this.on(WebSocketResponseEvents.POD_UPDATED, callback)
  }

  /**
   * Listen for pod:deleted event
   */
  onPodDeleted(callback: EventCallback<PodDeletedPayload>): void {
    this.on(WebSocketResponseEvents.POD_DELETED, callback)
  }

  /**
   * Listen for pod:git:clone:progress event
   */
  onGitCloneProgress(callback: EventCallback<PodGitCloneProgressPayload>): void {
    this.on(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, callback)
  }

  /**
   * Listen for pod:git:clone:result event
   */
  onGitCloneResult(callback: EventCallback<PodGitCloneResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_GIT_CLONE_RESULT, callback)
  }

  /**
   * Listen for pod:chat:message event
   */
  onChatMessage(callback: EventCallback<PodChatMessagePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_MESSAGE, callback)
  }

  /**
   * Listen for pod:chat:tool_use event
   */
  onChatToolUse(callback: EventCallback<PodChatToolUsePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_TOOL_USE, callback)
  }

  /**
   * Listen for pod:chat:tool_result event
   */
  onChatToolResult(callback: EventCallback<PodChatToolResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, callback)
  }

  /**
   * Listen for pod:chat:complete event
   */
  onChatComplete(callback: EventCallback<PodChatCompletePayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_COMPLETE, callback)
  }

  /**
   * Listen for pod:chat:history:result event
   */
  onChatHistoryResult(callback: EventCallback<PodChatHistoryResultPayload>): void {
    this.on(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, callback)
  }

  /**
   * Listen for pod:joined event
   */
  onPodJoined(callback: EventCallback<PodJoinedPayload>): void {
    this.on(WebSocketResponseEvents.POD_JOINED, callback)
  }

  /**
   * Listen for pod:left event
   */
  onPodLeft(callback: EventCallback<PodLeftPayload>): void {
    this.on(WebSocketResponseEvents.POD_LEFT, callback)
  }

  /**
   * Listen for pod:error event
   */
  onError(callback: EventCallback<PodErrorPayload>): void {
    this.on(WebSocketResponseEvents.POD_ERROR, callback)
  }

  // ============================================================================
  // Listener Removal Methods
  // ============================================================================

  /**
   * Remove connection:ready listener
   */
  offConnectionReady(callback: EventCallback<ConnectionReadyPayload>): void {
    this.off(WebSocketResponseEvents.CONNECTION_READY, callback)
  }

  /**
   * Remove pod:created listener
   */
  offPodCreated(callback: EventCallback<PodCreatedPayload>): void {
    this.off(WebSocketResponseEvents.POD_CREATED, callback)
  }

  /**
   * Remove pod:list:result listener
   */
  offPodListResult(callback: EventCallback<PodListResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_LIST_RESULT, callback)
  }

  /**
   * Remove pod:updated listener
   */
  offPodUpdated(callback: EventCallback<PodUpdatedPayload>): void {
    this.off(WebSocketResponseEvents.POD_UPDATED, callback)
  }

  /**
   * Remove pod:deleted listener
   */
  offPodDeleted(callback: EventCallback<PodDeletedPayload>): void {
    this.off(WebSocketResponseEvents.POD_DELETED, callback)
  }

  /**
   * Remove pod:git:clone:progress listener
   */
  offGitCloneProgress(callback: EventCallback<PodGitCloneProgressPayload>): void {
    this.off(WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS, callback)
  }

  /**
   * Remove pod:git:clone:result listener
   */
  offGitCloneResult(callback: EventCallback<PodGitCloneResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_GIT_CLONE_RESULT, callback)
  }

  /**
   * Remove pod:chat:message listener
   */
  offChatMessage(callback: EventCallback<PodChatMessagePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_MESSAGE, callback)
  }

  /**
   * Remove pod:chat:tool_use listener
   */
  offChatToolUse(callback: EventCallback<PodChatToolUsePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_TOOL_USE, callback)
  }

  /**
   * Remove pod:chat:tool_result listener
   */
  offChatToolResult(callback: EventCallback<PodChatToolResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, callback)
  }

  /**
   * Remove pod:chat:complete listener
   */
  offChatComplete(callback: EventCallback<PodChatCompletePayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_COMPLETE, callback)
  }

  /**
   * Remove pod:chat:history:result listener
   */
  offChatHistoryResult(callback: EventCallback<PodChatHistoryResultPayload>): void {
    this.off(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, callback)
  }

  /**
   * Remove pod:error listener
   */
  offError(callback: EventCallback<PodErrorPayload>): void {
    this.off(WebSocketResponseEvents.POD_ERROR, callback)
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Emit an event to the server
   */
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

  /**
   * Register an event listener
   */
  private on<T>(event: WebSocketResponseEvents, callback: EventCallback<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot register listener, not initialized:', event)
      return
    }

    this.socket.on(event, callback as EventCallback<unknown>)
  }

  /**
   * Remove an event listener
   */
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
