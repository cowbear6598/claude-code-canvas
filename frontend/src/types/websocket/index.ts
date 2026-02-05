// WebSocket Types Entry Point

export * from './events'
export * from './requests'
export * from './responses'

// WebSocket 訊息格式定義
export interface WebSocketMessage<T = unknown> {
  type: string          // 對應原本的事件名稱
  payload: T            // 訊息內容
  requestId?: string    // 用於請求-回應配對
  ackId?: string        // 用於需要確認的訊息
}

// Ack 訊息格式
export interface WebSocketAckMessage {
  type: 'ack'
  ackId: string
  payload: unknown
}
