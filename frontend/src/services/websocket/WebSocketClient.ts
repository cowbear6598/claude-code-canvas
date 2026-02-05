import { io, Socket } from 'socket.io-client'
import { ref } from 'vue'

type EventCallback<T> = (payload: T) => void
type AckCallback = (response?: unknown) => void
type EventCallbackWithAck<T> = (payload: T, ack: AckCallback) => void

const RECONNECT_INTERVAL_MS = 3000

class WebSocketClient {
  private socket: Socket | null = null
  private reconnectTimer: ReturnType<typeof setInterval> | null = null
  private wsUrl: string = ''

  public readonly isConnected = ref(false)
  public readonly disconnectReason = ref<string | null>(null)

  connect(url?: string): void {
    if (this.socket?.connected) {
      return
    }

    // 自動使用目前網址的 hostname，這樣從 192.168.x.x:5173 訪問時會自動連到 192.168.x.x:3001
    const defaultUrl = `http://${window.location.hostname}:3001`
    this.wsUrl = url || import.meta.env.VITE_WS_URL || defaultUrl

    this.socket = io(this.wsUrl, {
      reconnection: false,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    })

    this.setupConnectionHandlers()
  }

  disconnect(): void {
    this.stopReconnect()
    this.cleanupSocket()
  }

  private cleanupSocket(): void {
    if (!this.socket) {
      return
    }

    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.isConnected.value = false
  }

  private startReconnect(): void {
    this.stopReconnect()

    this.reconnectTimer = setInterval(() => {
      console.log('[WebSocket] Attempting to reconnect...')
      this.reconnectOnce()
    }, RECONNECT_INTERVAL_MS)
  }

  private stopReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearInterval(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private reconnectOnce(): void {
    this.cleanupSocket()

    this.socket = io(this.wsUrl, {
      reconnection: false,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    })

    this.setupConnectionHandlers()
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
      this.stopReconnect()
      this.disconnectReason.value = null
      this.isConnected.value = true
    })

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected.value = false
      this.disconnectReason.value = reason
      this.startReconnect()
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error)
    })
  }
}

export const websocketClient = new WebSocketClient()
