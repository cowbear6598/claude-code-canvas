/**
 * WebSocket Service
 * Centralized WebSocket client and request factory
 */

export { websocketClient } from './WebSocketClient'
export { createWebSocketRequest } from './createWebSocketRequest'
export { WebSocketRequestEvents, WebSocketResponseEvents } from '@/types/websocket/events'
export type { WebSocketRequestConfig } from './createWebSocketRequest'

export * from '@/types/websocket'
