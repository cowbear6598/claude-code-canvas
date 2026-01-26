/**
 * WebSocket Service
 * Centralized WebSocket client and request factory
 */

export { websocketClient } from './WebSocketClient'
export { createWebSocketRequest } from './createWebSocketRequest'
export { WebSocketRequestEvents, WebSocketResponseEvents } from './events'
export type { WebSocketRequestConfig } from './createWebSocketRequest'

// Export all WebSocket types for convenience
export * from '@/types/websocket'
