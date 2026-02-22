import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'

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
  const isPanning = ref(false)
  const hasPanned = ref(false)

  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0
  let panStartEvent: MouseEvent | null = null

  const startPan = (e: MouseEvent): void => {
    if (e.button !== 2) return

    const target = e.target as HTMLElement

    if (
      target.id === 'canvas' ||
      target.classList.contains('canvas-grid') ||
      target.classList.contains('canvas-content')
    ) {
      isPanning.value = true
      hasPanned.value = false
      startX = e.clientX
      startY = e.clientY
      startOffsetX = viewportStore.offset.x
      startOffsetY = viewportStore.offset.y
      panStartEvent = e

      document.addEventListener('mousemove', onPanMove)
      document.addEventListener('mouseup', stopPan)
    }
  }

  const onPanMove = (e: MouseEvent): void => {
    if (!isPanning.value) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (!hasPanned.value && (Math.abs(dx) > MIN_PAN_DISTANCE || Math.abs(dy) > MIN_PAN_DISTANCE)) {
      hasPanned.value = true
    }

    viewportStore.setOffset(startOffsetX + dx, startOffsetY + dy)
  }

  const stopPan = (): void => {
    const didPan = hasPanned.value
    const event = panStartEvent

    isPanning.value = false
    panStartEvent = null
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', stopPan)

    // Mac 上 contextmenu 事件可能早於 mouseup 觸發，
    // 改在 mouseup 時判斷是否為單純右鍵點擊，才觸發選單
    if (!didPan && options?.onRightClick && event) {
      options.onRightClick(event)
    }
  }

  const resetPanState = (): void => {
    hasPanned.value = false
  }

  onUnmounted(() => {
    stopPan()
  })

  return {
    isPanning,
    hasPanned,
    startPan,
    resetPanState,
  }
}
