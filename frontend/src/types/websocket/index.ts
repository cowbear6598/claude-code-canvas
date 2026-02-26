export * from './events'
export * from './requests'
export * from './responses'

export interface WebSocketMessage<T = unknown> {
  type: string
  payload: T
  requestId?: string
  ackId?: string
}

export interface WebSocketAckMessage {
  type: 'ack'
  ackId: string
  payload: unknown
}
