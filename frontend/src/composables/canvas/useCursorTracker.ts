import { type Ref, onMounted, onUnmounted } from 'vue'
import { websocketClient } from '@/services/websocket'
import { WebSocketRequestEvents } from '@/types/websocket'
import type { CursorMovePayload } from '@/types/websocket'
import { useViewportStore } from '@/stores/pod/viewportStore'

const THROTTLE_INTERVAL_MS = 100

export function useCursorTracker(containerRef: Ref<HTMLElement | null>): void {
  const viewportStore = useViewportStore()

  let lastSentTime = 0
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  const sendCursorPosition = (x: number, y: number): void => {
    websocketClient.emit<CursorMovePayload>(WebSocketRequestEvents.CURSOR_MOVE, { x, y })
    lastSentTime = Date.now()
  }

  const handleMouseMove = (e: MouseEvent): void => {
    if (!websocketClient.isConnected.value) return

    const canvasPos = viewportStore.screenToCanvas(e.clientX, e.clientY)
    const now = Date.now()
    const elapsed = now - lastSentTime

    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }

    if (elapsed >= THROTTLE_INTERVAL_MS) {
      sendCursorPosition(canvasPos.x, canvasPos.y)
    } else {
      const remaining = THROTTLE_INTERVAL_MS - elapsed
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        sendCursorPosition(canvasPos.x, canvasPos.y)
      }, remaining)
    }
  }

  onMounted(() => {
    if (!containerRef.value) return
    containerRef.value.addEventListener('mousemove', handleMouseMove)
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('mousemove', handleMouseMove)
    }

    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
  })
}
