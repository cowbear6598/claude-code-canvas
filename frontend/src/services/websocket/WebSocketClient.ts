import { io, Socket } from 'socket.io-client'
import { ref, computed } from 'vue'

type EventCallback<T> = (payload: T) => void
type AckCallback = (response?: unknown) => void
type EventCallbackWithAck<T> = (payload: T, ack: AckCallback) => void

const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MS: 1000,
} as const

class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS
  private readonly reconnectDelay = WS_CONFIG.RECONNECT_DELAY_MS

  public readonly socketId = ref<string | null>(null)
  public readonly isConnected = computed(() => this.socket?.connected ?? false)
  public readonly disconnectReason = ref<string | null>(null)

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

  emit<T>(event: string, payload: T): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Cannot emit, not connected:', event)
      return
    }

    this.socket.emit(event, payload)
  }

  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot register listener, not initialized:', event)
      return
    }

    this.socket.on(event, callback as EventCallback<unknown>)
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot remove listener, not initialized:', event)
      return
    }

    this.socket.off(event, callback as EventCallback<unknown>)
  }

  onWithAck<T>(event: string, callback: EventCallbackWithAck<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot register listener with ack, not initialized:', event)
      return
    }

    this.socket.on(event, callback)
  }

  offWithAck<T>(event: string, callback: EventCallbackWithAck<T>): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot remove listener with ack, not initialized:', event)
      return
    }

    this.socket.off(event, callback)
  }

  isSocketConnected(): boolean {
    return this.socket?.connected ?? false
  }

  onDisconnect(callback: (reason: string) => void): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot register disconnect listener, not initialized')
      return
    }

    this.socket.on('disconnect', callback)
  }

  offDisconnect(callback: (reason: string) => void): void {
    if (!this.socket) {
      console.error('[WebSocket] Cannot remove disconnect listener, not initialized')
      return
    }

    this.socket.off('disconnect', callback)
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
      this.disconnectReason.value = null
    })

    this.socket.on('disconnect', (reason: string) => {
      this.socketId.value = null
      this.disconnectReason.value = reason
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
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('[WebSocket] Reconnection error:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed')
    })
  }
}

export const websocketClient = new WebSocketClient()
