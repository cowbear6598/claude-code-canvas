import { io, Socket } from 'socket.io-client'
import { ref, computed } from 'vue'

type EventCallback<T> = (payload: T) => void

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
}

export const websocketClient = new WebSocketClient()
