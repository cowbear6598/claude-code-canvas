import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'

export function useCanvasPan(): {
  isPanning: import('vue').Ref<boolean>
  startPan: (e: MouseEvent) => void
} {
  const { viewportStore } = useCanvasContext()
  const isPanning = ref(false)

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

    viewportStore.setOffset(startOffsetX + dx, startOffsetY + dy)
  }

  const stopPan = (): void => {
    isPanning.value = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', stopPan)
  }

  onUnmounted(() => {
    stopPan()
  })

  return {
    isPanning,
    startPan,
  }
}
