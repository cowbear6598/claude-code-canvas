import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { isCtrlOrCmdPressed } from '@/utils/keyboardHelpers'

export function useBoxSelect(): {
  isBoxSelecting: import('vue').Ref<boolean>
  startBoxSelect: (e: MouseEvent) => void
} {
  const { viewportStore, selectionStore, podStore, outputStyleStore, skillStore, subAgentStore, repositoryStore, commandStore } = useCanvasContext()

  const isBoxSelecting = ref(false)

  let currentMoveHandler: ((e: MouseEvent) => void) | null = null
  let currentUpHandler: (() => void) | null = null

  const cleanupEventListeners = (): void => {
    if (currentMoveHandler) {
      document.removeEventListener('mousemove', currentMoveHandler)
      currentMoveHandler = null
    }
    if (currentUpHandler) {
      document.removeEventListener('mouseup', currentUpHandler)
      currentUpHandler = null
    }
  }

  const startBoxSelect = (e: MouseEvent): void => {
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    if (!target.classList.contains('canvas-grid') &&
        !target.classList.contains('canvas-content')) {
      return
    }

    if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }

    e.preventDefault()

    if (viewportStore.zoom === 0) return

    const canvasX = (e.clientX - viewportStore.offset.x) / viewportStore.zoom
    const canvasY = (e.clientY - viewportStore.offset.y) / viewportStore.zoom

    const isCtrlPressed = isCtrlOrCmdPressed(e)
    selectionStore.startSelection(canvasX, canvasY, isCtrlPressed)
    isBoxSelecting.value = true

    cleanupEventListeners()

    currentMoveHandler = (moveEvent: MouseEvent): void => {
      const moveCanvasX = (moveEvent.clientX - viewportStore.offset.x) / viewportStore.zoom
      const moveCanvasY = (moveEvent.clientY - viewportStore.offset.y) / viewportStore.zoom
      selectionStore.updateSelection(moveCanvasX, moveCanvasY)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
    }

    currentUpHandler = (): void => {
      selectionStore.endSelection()
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
