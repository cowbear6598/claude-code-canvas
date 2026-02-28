import { ref } from 'vue'
import type { WebSocketMessage, WebSocketAckMessage } from '@/types/websocket'
import { logger } from '@/utils/logger'

type EventCallback<T> = (payload: T) => void
type AckCallback = (response?: unknown) => void
type EventCallbackWithAck<T> = (payload: T, ack: AckCallback) => void

const RECONNECT_INTERVAL_MS = 3000

type EventHandler = EventCallback<unknown> | EventCallbackWithAck<unknown>

function castToEventHandler<T>(callback: EventCallback<T> | EventCallbackWithAck<T>): EventHandler {
    return callback as unknown as EventHandler
}

class WebSocketClient {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setInterval> | null = null
  private wsUrl: string = ''
  private eventListeners: Map<string, Set<EventHandler>> = new Map()
  private ackCallbacks: Map<string, AckCallback> = new Map()
  private disconnectListeners: Set<(reason: string) => void> = new Set()

  public readonly isConnected = ref(false)
  public readonly disconnectReason = ref<string | null>(null)

  connect(url?: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return
    }

    const VITE_DEFAULT_DEV_PORT = '5173'
    const BACKEND_DEV_PORT = 3001

    // dev 模式（port 5173）連到後端 port 3001；prod 模式（前後端同 port）直接用當前 origin
    const isDev = window.location.port === VITE_DEFAULT_DEV_PORT
    const defaultUrl = isDev
      ? `http://${window.location.hostname}:${BACKEND_DEV_PORT}`
      : window.location.origin
    this.wsUrl = url || import.meta.env.VITE_WS_URL || defaultUrl

    // 將 http:// 或 https:// 改為 ws:// 或 wss://
    const wsProtocol = this.wsUrl.replace(/^http/, 'ws')

    this.socket = new WebSocket(wsProtocol)
    this.socket.onopen = this.handleOpen.bind(this)
    this.socket.onclose = this.handleClose.bind(this)
    this.socket.onerror = this.handleError.bind(this)
    this.socket.onmessage = this.handleMessage.bind(this)
  }

  disconnect(): void {
    this.stopReconnect()
    this.cleanupSocket()
  }

  private cleanupSocket(): void {
    if (!this.socket) {
      return
    }

    this.socket.onopen = null
    this.socket.onclose = null
    this.socket.onerror = null
    this.socket.onmessage = null

    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close()
    }

    this.socket = null
    this.isConnected.value = false
  }

  private startReconnect(): void {
    this.stopReconnect()

    this.reconnectTimer = setInterval(() => {
      logger.log('[WebSocket] 嘗試重新連線...')
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

    const wsProtocol = this.wsUrl.replace(/^http/, 'ws')
    this.socket = new WebSocket(wsProtocol)
    this.socket.onopen = this.handleOpen.bind(this)
    this.socket.onclose = this.handleClose.bind(this)
    this.socket.onerror = this.handleError.bind(this)
    this.socket.onmessage = this.handleMessage.bind(this)
  }

  private handleOpen(): void {
    logger.log('[WebSocket] 連線成功')
    this.stopReconnect()
    this.disconnectReason.value = null
    this.isConnected.value = true
  }

  private handleClose(event: CloseEvent): void {
    logger.log('[WebSocket] 連線關閉:', event.code, event.reason)
    this.isConnected.value = false
    this.disconnectReason.value = event.reason || `關閉代碼: ${event.code}`

    // 觸發斷線監聽器
    this.disconnectListeners.forEach(callback => {
      try {
        callback(this.disconnectReason.value ?? '')
      } catch (error) {
        logger.error('[WebSocket] 斷線監聽器錯誤:', error)
      }
    })

    this.startReconnect()
  }

  private handleError(event: Event): void {
    logger.error('[WebSocket] 連線錯誤:', event)
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage

      if (message.type === 'ack') {
        const ackMessage = message as WebSocketAckMessage
        const callback = this.ackCallbacks.get(ackMessage.ackId)
        if (callback) {
          this.ackCallbacks.delete(ackMessage.ackId)
          callback(ackMessage.payload)
        }
        return
      }

      const listeners = this.eventListeners.get(message.type)
      if (listeners) {
        listeners.forEach(callback => {
          try {
            if (message.ackId) {
              const ack = (response?: unknown): void => {
                const ackMessage: WebSocketAckMessage = {
                  type: 'ack',
                  ackId: message.ackId!,
                  payload: response
                }
                this.socket?.send(JSON.stringify(ackMessage))
              }
              ;(callback as EventCallbackWithAck<unknown>)(message.payload, ack)
            } else {
              ;(callback as EventCallback<unknown>)(message.payload)
            }
          } catch (error) {
            logger.error('[WebSocket] 監聽器執行錯誤:', error)
          }
        })
      }
    } catch (error) {
      logger.error('[WebSocket] 訊息解析錯誤:', error)
    }
  }

  emit<T>(event: string, payload: T): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.error('[WebSocket] 無法發送訊息，未連線:', event)
      return
    }

    const payloadWithRequestId = payload as T & { requestId?: string }
    const message: WebSocketMessage<T> = {
      type: event,
      payload,
      requestId: payloadWithRequestId.requestId
    }

    this.socket.send(JSON.stringify(message))
  }

  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(castToEventHandler(callback))
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(castToEventHandler(callback))
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
  }

  onWithAck<T>(event: string, callback: EventCallbackWithAck<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(castToEventHandler(callback))
  }

  offWithAck<T>(event: string, callback: EventCallbackWithAck<T>): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(castToEventHandler(callback))
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
  }

  onDisconnect(callback: (reason: string) => void): void {
    this.disconnectListeners.add(callback)
  }

  offDisconnect(callback: (reason: string) => void): void {
    this.disconnectListeners.delete(callback)
  }
}

export const websocketClient = new WebSocketClient()
