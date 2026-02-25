import { onUnmounted } from 'vue'
import { websocketClient } from '@/services/websocket'
import { WebSocketResponseEvents } from '@/types/websocket'
import type { CursorMovedPayload, CursorLeftPayload } from '@/types/websocket'
import { useCursorStore } from '@/stores/cursorStore'
import { useChatStore } from '@/stores/chat/chatStore'

export function useRemoteCursors(): void {
  const cursorStore = useCursorStore()
  const chatStore = useChatStore()

  const handleCursorMoved = (payload: CursorMovedPayload): void => {
    if (payload.connectionId === chatStore.socketId) return
    cursorStore.addOrUpdateCursor(payload)
  }

  const handleCursorLeft = (payload: CursorLeftPayload): void => {
    cursorStore.removeCursor(payload.connectionId)
  }

  const handleDisconnect = (): void => {
    cursorStore.clearAllCursors()
  }

  websocketClient.on<CursorMovedPayload>(WebSocketResponseEvents.CURSOR_MOVED, handleCursorMoved)
  websocketClient.on<CursorLeftPayload>(WebSocketResponseEvents.CURSOR_LEFT, handleCursorLeft)
  websocketClient.onDisconnect(handleDisconnect)

  onUnmounted(() => {
    websocketClient.off<CursorMovedPayload>(WebSocketResponseEvents.CURSOR_MOVED, handleCursorMoved)
    websocketClient.off<CursorLeftPayload>(WebSocketResponseEvents.CURSOR_LEFT, handleCursorLeft)
    websocketClient.offDisconnect(handleDisconnect)
    cursorStore.clearAllCursors()
  })
}
