import { ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { useDragHandler } from '@/composables/useDragHandler'

// 最小拖曳距離閾值（像素）
const MIN_PAN_DISTANCE = 3

interface CanvasPanOptions {
  onRightClick?: (e: MouseEvent) => void
}

export function useCanvasPan(options?: CanvasPanOptions): {
  isPanning: import('vue').Ref<boolean>
  hasPanned: import('vue').Ref<boolean>
  startPan: (e: MouseEvent) => void
  resetPanState: () => void
} {
  const { viewportStore } = useCanvasContext()
  const hasPanned = ref(false)

  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0
  let panStartEvent: MouseEvent | null = null

  const { isDragging: isPanning, startDrag } = useDragHandler({
    button: 2,
    onMove: (e: MouseEvent): void => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (!hasPanned.value && (Math.abs(dx) > MIN_PAN_DISTANCE || Math.abs(dy) > MIN_PAN_DISTANCE)) {
        hasPanned.value = true
      }

      viewportStore.setOffset(startOffsetX + dx, startOffsetY + dy)
    },
    onEnd: (): void => {
      const didPan = hasPanned.value
      const event = panStartEvent

      panStartEvent = null

      // Mac 上 contextmenu 事件可能早於 mouseup 觸發，
      // 改在 mouseup 時判斷是否為單純右鍵點擊，才觸發選單
      if (!didPan && options?.onRightClick && event) {
        options.onRightClick(event)
      }
    }
  })

  const startPan = (e: MouseEvent): void => {
    if (e.button !== 2) return

    const target = e.target as HTMLElement

    if (
      target.id === 'canvas' ||
      target.classList.contains('canvas-grid') ||
      target.classList.contains('canvas-content')
    ) {
      hasPanned.value = false
      startX = e.clientX
      startY = e.clientY
      startOffsetX = viewportStore.offset.x
      startOffsetY = viewportStore.offset.y
      panStartEvent = e

      startDrag(e)
    }
  }

  const resetPanState = (): void => {
    hasPanned.value = false
  }

  return {
    isPanning,
    hasPanned,
    startPan,
    resetPanState,
  }
}
