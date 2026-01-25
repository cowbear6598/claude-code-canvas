import { ref, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'

export function useBoxSelect() {
  const canvasStore = useCanvasStore()
  const isBoxSelecting = ref(false)

  let currentMoveHandler: ((e: MouseEvent) => void) | null = null
  let currentUpHandler: (() => void) | null = null

  const cleanupEventListeners = () => {
    if (currentMoveHandler) {
      document.removeEventListener('mousemove', currentMoveHandler)
      currentMoveHandler = null
    }
    if (currentUpHandler) {
      document.removeEventListener('mouseup', currentUpHandler)
      currentUpHandler = null
    }
  }

  const startBoxSelect = (e: MouseEvent) => {
    if (e.button !== 2) return

    const target = e.target as HTMLElement
    if (!target.classList.contains('canvas-grid') &&
        !target.classList.contains('canvas-content')) {
      return
    }

    e.preventDefault()

    const viewport = canvasStore.viewport
    const canvasX = (e.clientX - viewport.offset.x) / viewport.zoom
    const canvasY = (e.clientY - viewport.offset.y) / viewport.zoom

    canvasStore.startSelection(canvasX, canvasY)
    isBoxSelecting.value = true

    cleanupEventListeners()

    currentMoveHandler = (moveEvent: MouseEvent) => {
      const moveCanvasX = (moveEvent.clientX - viewport.offset.x) / viewport.zoom
      const moveCanvasY = (moveEvent.clientY - viewport.offset.y) / viewport.zoom
      canvasStore.updateSelection(moveCanvasX, moveCanvasY)
    }

    currentUpHandler = () => {
      canvasStore.endSelection()
      isBoxSelecting.value = false
      cleanupEventListeners()
    }

    document.addEventListener('mousemove', currentMoveHandler)
    document.addEventListener('mouseup', currentUpHandler)
  }

  onUnmounted(() => {
    cleanupEventListeners()
  })

  return {
    isBoxSelecting,
    startBoxSelect
  }
}
