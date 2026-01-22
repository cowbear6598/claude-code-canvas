import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'

export function useCanvasPan() {
  const store = useCanvasStore()
  const isPanning = ref(false)

  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0

  const startPan = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    if (
      target.id === 'canvas' ||
      target.classList.contains('canvas-grid') ||
      target.classList.contains('canvas-content')
    ) {
      isPanning.value = true
      startX = e.clientX
      startY = e.clientY
      startOffsetX = store.viewport.offset.x
      startOffsetY = store.viewport.offset.y

      document.addEventListener('mousemove', onPanMove)
      document.addEventListener('mouseup', stopPan)
    }
  }

  const onPanMove = (e: MouseEvent) => {
    if (!isPanning.value) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    store.setOffset(startOffsetX + dx, startOffsetY + dy)
  }

  const stopPan = () => {
    isPanning.value = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', stopPan)
  }

  return {
    isPanning,
    startPan,
  }
}
