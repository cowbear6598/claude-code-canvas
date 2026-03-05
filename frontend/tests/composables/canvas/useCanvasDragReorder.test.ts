import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { setupStoreTest } from '../../helpers/testSetup'
import { webSocketMockFactory } from '../../helpers/mockWebSocket'
import { useCanvasDragReorder } from '@/composables/canvas/useCanvasDragReorder'
import { useCanvasStore } from '@/stores/canvasStore'

vi.mock('@/services/websocket', () => webSocketMockFactory())

// jsdom 沒有 DragEvent，補上 polyfill
if (typeof globalThis.DragEvent === 'undefined') {
  class DragEventPolyfill extends Event {
    dataTransfer: DataTransfer | null
    relatedTarget: EventTarget | null
    constructor(type: string, init?: DragEventInit) {
      super(type, init)
      this.dataTransfer = (init?.dataTransfer ?? null) as DataTransfer | null
      this.relatedTarget = null
    }
  }
  globalThis.DragEvent = DragEventPolyfill as unknown as typeof DragEvent
}

describe('useCanvasDragReorder', () => {
  setupStoreTest()

  function createComposable() {
    const sidebarRef = ref<HTMLElement | undefined>(undefined)
    return {
      composable: useCanvasDragReorder(sidebarRef),
      sidebarRef,
    }
  }

  function createDragEvent(): DragEvent {
    const mockDataTransfer = {
      effectAllowed: '' as DataTransfer['effectAllowed'],
      dropEffect: '' as DataTransfer['dropEffect'],
      setData: vi.fn(),
    }
    const event = new DragEvent('dragstart')
    Object.defineProperty(event, 'dataTransfer', {
      value: mockDataTransfer,
      writable: true,
    })
    return event
  }

  describe('handleDragStart', () => {
    it('應記錄 draggedIndex', () => {
      const canvasStore = useCanvasStore()
      canvasStore.canvases = [
        { id: 'canvas-1', name: 'Canvas 1', sortIndex: 0 },
        { id: 'canvas-2', name: 'Canvas 2', sortIndex: 1 },
      ] as ReturnType<typeof useCanvasStore>['canvases']

      const { composable } = createComposable()
      const event = createDragEvent()

      composable.handleDragStart(event, 1)

      expect(composable.draggedIndex.value).toBe(1)
    })
  })

  describe('handleDrop', () => {
    it('Drop 到不同位置時應呼叫 canvasStore.reorderCanvases', () => {
      const canvasStore = useCanvasStore()
      canvasStore.canvases = [
        { id: 'canvas-1', name: 'Canvas 1', sortIndex: 0 },
        { id: 'canvas-2', name: 'Canvas 2', sortIndex: 1 },
        { id: 'canvas-3', name: 'Canvas 3', sortIndex: 2 },
      ] as ReturnType<typeof useCanvasStore>['canvases']

      const reorderSpy = vi.spyOn(canvasStore, 'reorderCanvases').mockImplementation(() => {})

      const { composable } = createComposable()
      const dragEvent = createDragEvent()

      composable.handleDragStart(dragEvent, 0)
      composable.handleDrop(createDragEvent(), 2)

      expect(reorderSpy).toHaveBeenCalledWith(0, 2)
    })

    it('Drop 到相同位置時不應呼叫 reorderCanvases', () => {
      const canvasStore = useCanvasStore()
      canvasStore.canvases = [
        { id: 'canvas-1', name: 'Canvas 1', sortIndex: 0 },
        { id: 'canvas-2', name: 'Canvas 2', sortIndex: 1 },
      ] as ReturnType<typeof useCanvasStore>['canvases']

      const reorderSpy = vi.spyOn(canvasStore, 'reorderCanvases').mockImplementation(() => {})

      const { composable } = createComposable()
      const dragEvent = createDragEvent()

      composable.handleDragStart(dragEvent, 1)
      composable.handleDrop(createDragEvent(), 1)

      expect(reorderSpy).not.toHaveBeenCalled()
    })
  })

  describe('cancelDrag', () => {
    it('有進行中的拖拉時，應呼叫 revertCanvasOrder 還原順序', () => {
      const canvasStore = useCanvasStore()
      canvasStore.canvases = [
        { id: 'canvas-1', name: 'Canvas 1', sortIndex: 0 },
        { id: 'canvas-2', name: 'Canvas 2', sortIndex: 1 },
      ] as ReturnType<typeof useCanvasStore>['canvases']

      const revertSpy = vi.spyOn(canvasStore, 'revertCanvasOrder').mockImplementation(() => {})

      const { composable } = createComposable()
      const dragEvent = createDragEvent()

      composable.handleDragStart(dragEvent, 0)
      composable.cancelDrag()

      expect(revertSpy).toHaveBeenCalled()
    })

    it('沒有進行中的拖拉時，不應呼叫 revertCanvasOrder', () => {
      const canvasStore = useCanvasStore()

      const revertSpy = vi.spyOn(canvasStore, 'revertCanvasOrder').mockImplementation(() => {})

      const { composable } = createComposable()

      composable.cancelDrag()

      expect(revertSpy).not.toHaveBeenCalled()
    })
  })
})
