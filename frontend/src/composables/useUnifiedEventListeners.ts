import { ref } from 'vue'
import { websocketClient, WebSocketResponseEvents } from '@/services/websocket'
import { getPodEventListeners, handlePodChatUserMessage } from './eventHandlers/podEventHandlers'
import { getConnectionEventListeners } from './eventHandlers/connectionEventHandlers'
import { getNoteEventListeners } from './eventHandlers/noteEventHandlers'
import { getCanvasEventListeners } from './eventHandlers/canvasEventHandlers'
import { getIntegrationEventListeners, handleIntegrationConnectionStatusChanged } from './eventHandlers/integrationEventHandlers'

const isListenerRegistered = ref(false)

export const listeners = [
  ...getPodEventListeners(),
  ...getConnectionEventListeners(),
  ...getNoteEventListeners(),
  ...getCanvasEventListeners(),
  ...getIntegrationEventListeners(),
]

export function registerUnifiedListeners(): void {
  if (isListenerRegistered.value) return
  isListenerRegistered.value = true

  for (const { event, handler } of listeners) {
    websocketClient.on(event, handler)
  }

  websocketClient.on(WebSocketResponseEvents.POD_CHAT_USER_MESSAGE, handlePodChatUserMessage as (payload: unknown) => void)
  websocketClient.on(WebSocketResponseEvents.INTEGRATION_CONNECTION_STATUS_CHANGED, handleIntegrationConnectionStatusChanged as (payload: unknown) => void)
}

export function unregisterUnifiedListeners(): void {
  if (!isListenerRegistered.value) return
  isListenerRegistered.value = false

  for (const { event, handler } of listeners) {
    websocketClient.off(event, handler)
  }

  websocketClient.off(WebSocketResponseEvents.POD_CHAT_USER_MESSAGE, handlePodChatUserMessage as (payload: unknown) => void)
  websocketClient.off(WebSocketResponseEvents.INTEGRATION_CONNECTION_STATUS_CHANGED, handleIntegrationConnectionStatusChanged as (payload: unknown) => void)
}

export const useUnifiedEventListeners = (): {
  registerUnifiedListeners: () => void
  unregisterUnifiedListeners: () => void
} => {
  return {
    registerUnifiedListeners,
    unregisterUnifiedListeners,
  }
}
