import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface UseSlotDropTargetOptions {
  slotRef: Ref<HTMLElement | null>
  draggedNoteId: () => string | null
  validateDrop: (noteId: string) => boolean
  onDrop: (noteId: string) => void
}

interface UseSlotDropTargetReturn {
  isDropTarget: Ref<boolean>
  isInserting: Ref<boolean>
}

export function useSlotDropTarget(options: UseSlotDropTargetOptions): UseSlotDropTargetReturn {
  const { slotRef, draggedNoteId, validateDrop, onDrop } = options

  const isDropTarget = ref(false)
  const isInserting = ref(false)
  const lastDraggedNoteId = ref<string | null>(null)

  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
  let mouseUpHandler: (() => void) | null = null

  const checkDropTarget = (e: MouseEvent): void => {
    if (!slotRef.value) {
      isDropTarget.value = false
      return
    }

    const rect = slotRef.value.getBoundingClientRect()

    isDropTarget.value = e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
  }

  const handleDrop = (): void => {
    const noteId = lastDraggedNoteId.value
    if (!isDropTarget.value || !noteId) {
      isDropTarget.value = false
      return
    }

    if (!validateDrop(noteId)) {
      isDropTarget.value = false
      return
    }

    isInserting.value = true
    onDrop(noteId)

    setTimeout(() => {
      isInserting.value = false
    }, 300)

    isDropTarget.value = false
  }

  const setupListeners = (): void => {
    mouseMoveHandler = checkDropTarget
    mouseUpHandler = handleDrop
    document.addEventListener('mousemove', mouseMoveHandler)
    document.addEventListener('mouseup', mouseUpHandler, { capture: true })
  }

  const cleanupListeners = (): void => {
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler)
      mouseMoveHandler = null
    }
    if (mouseUpHandler) {
      document.removeEventListener('mouseup', mouseUpHandler, { capture: true })
      mouseUpHandler = null
    }
    isDropTarget.value = false
  }

  watch(draggedNoteId, (newVal) => {
    if (newVal) {
      lastDraggedNoteId.value = newVal
      setupListeners()
    } else {
      cleanupListeners()
    }
  })

  onMounted(() => {
    const currentDraggedNoteId = draggedNoteId()
    if (currentDraggedNoteId) {
      lastDraggedNoteId.value = currentDraggedNoteId
      setupListeners()
    }
  })

  onUnmounted(() => {
    cleanupListeners()
  })

  return {
    isDropTarget,
    isInserting
  }
}
