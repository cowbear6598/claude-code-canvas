import { ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { isCtrlOrCmdPressed } from '@/utils/keyboardHelpers'
import { useDragHandler } from '@/composables/useDragHandler'

const BOX_SELECT_THRESHOLD = 5

export function useBoxSelect(): {
  isBoxSelecting: import('vue').Ref<boolean>
  startBoxSelect: (e: MouseEvent) => void
} {
  const { viewportStore, selectionStore, podStore, outputStyleStore, skillStore, subAgentStore, repositoryStore, commandStore } = useCanvasContext()

  const isBoxSelecting = ref(false)

  let startClientX = 0
  let startClientY = 0

  const { startDrag } = useDragHandler({
    onMove: (moveEvent: MouseEvent): void => {
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
    },
    onEnd: (upEvent: MouseEvent): void => {
      const deltaX = Math.abs(upEvent.clientX - startClientX)
      const deltaY = Math.abs(upEvent.clientY - startClientY)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (distance < BOX_SELECT_THRESHOLD) {
        selectionStore.cancelSelection()
      } else {
        selectionStore.endSelection()
      }

      isBoxSelecting.value = false
    }
  })

  const shouldStartBoxSelect = (e: MouseEvent, target: HTMLElement): boolean => {
    if (e.button !== 0) return false
    if (!target.classList.contains('canvas-grid') && !target.classList.contains('canvas-content')) return false
    if (viewportStore.zoom === 0) return false
    return true
  }

  const startBoxSelect = (e: MouseEvent): void => {
    const target = e.target as HTMLElement

    if (!shouldStartBoxSelect(e, target)) return

    if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }

    e.preventDefault()

    startClientX = e.clientX
    startClientY = e.clientY
    const canvasX = (e.clientX - viewportStore.offset.x) / viewportStore.zoom
    const canvasY = (e.clientY - viewportStore.offset.y) / viewportStore.zoom

    const isCtrlPressed = isCtrlOrCmdPressed(e)
    selectionStore.startSelection(canvasX, canvasY, isCtrlPressed)
    isBoxSelecting.value = true

    startDrag(e)
  }

  return {
    isBoxSelecting,
    startBoxSelect
  }
}
