import type { Ref } from 'vue'
import { ref } from 'vue'
import { useDragHandler } from '@/composables/useDragHandler'
import type { SelectableElement } from '@/types'

interface DragEmit {
  (event: 'drag-end', data: { id: string; x: number; y: number }): void
  (event: 'drag-complete', data: { id: string }): void
}

interface DragStores {
  viewportStore: {
    zoom: number
  }
  selectionStore: {
    setSelectedElements: (elements: SelectableElement[]) => void
  }
  podStore: {
    setActivePod: (podId: string) => void
  }
  connectionStore: {
    selectConnection: (id: null) => void
  }
}

interface UsePodDragReturn {
  isDragging: Ref<boolean>
  startSingleDrag: (e: MouseEvent) => void
}

export function usePodDrag(
  podId: Ref<string>,
  getPodPosition: () => { x: number; y: number },
  isElementSelected: (type: 'pod', id: string) => boolean,
  emit: DragEmit,
  stores: DragStores
): UsePodDragReturn {
  const { viewportStore, selectionStore, podStore, connectionStore } = stores

  const dragStart = ref<{ x: number; y: number; podX: number; podY: number } | null>(null)

  const { isDragging, startDrag } = useDragHandler({
    onMove: (moveEvent: MouseEvent): void => {
      if (!dragStart.value) return

      const dx = (moveEvent.clientX - dragStart.value.x) / viewportStore.zoom
      const dy = (moveEvent.clientY - dragStart.value.y) / viewportStore.zoom

      emit('drag-end', {
        id: podId.value,
        x: dragStart.value.podX + dx,
        y: dragStart.value.podY + dy,
      })
    },
    onEnd: (): void => {
      emit('drag-complete', { id: podId.value })
      dragStart.value = null
    }
  })

  const startSingleDrag = (e: MouseEvent): void => {
    if (!isElementSelected('pod', podId.value)) {
      selectionStore.setSelectedElements([{ type: 'pod' as const, id: podId.value }])
    }

    podStore.setActivePod(podId.value)
    connectionStore.selectConnection(null)

    const position = getPodPosition()
    dragStart.value = {
      x: e.clientX,
      y: e.clientY,
      podX: position.x,
      podY: position.y,
    }

    startDrag(e)
  }

  return {
    isDragging,
    startSingleDrag,
  }
}
