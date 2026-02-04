import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'

// 最小拖曳距離閾值（像素）
const MIN_PAN_DISTANCE = 3

export function useCanvasPan(): {
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

  const startPan = (e: MouseEvent): void => {
    if (e.button !== 2) return

    const target = e.target as HTMLElement

    if (
      target.id === 'canvas' ||
      target.classList.contains('canvas-grid') ||
      target.classList.contains('canvas-content')
    ) {
      isPanning.value = true
      hasPanned.value = false // 重置拖曳狀態
      startX = e.clientX
      startY = e.clientY
      startOffsetX = viewportStore.offset.x
      startOffsetY = viewportStore.offset.y

      document.addEventListener('mousemove', onPanMove)
      document.addEventListener('mouseup', stopPan)
    }
  }

  const onPanMove = (e: MouseEvent): void => {
    if (!isPanning.value) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    // 檢查滑鼠移動距離是否超過閾值
    if (!hasPanned.value && (Math.abs(dx) > MIN_PAN_DISTANCE || Math.abs(dy) > MIN_PAN_DISTANCE)) {
      hasPanned.value = true
    }

    viewportStore.setOffset(startOffsetX + dx, startOffsetY + dy)
  }

  const stopPan = (): void => {
    isPanning.value = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', stopPan)
    // 注意：不在這裡重置 hasPanned，讓 contextmenu 事件可以讀取
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
