import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { usePodDrag } from '@/composables/pod/usePodDrag'
import type { SelectableElement } from '@/types'

type DragEmit = {
  (event: 'drag-end', data: { id: string; x: number; y: number }): void
  (event: 'drag-complete', data: { id: string }): void
}

describe('usePodDrag', () => {
  const podId = ref('pod-1')

  let mockGetPodPosition: () => { x: number; y: number }
  let mockIsElementSelected: (type: 'pod', id: string) => boolean
  let mockEmit: DragEmit
  let mockSetSelectedElements: (elements: SelectableElement[]) => void
  let mockSetActivePod: (podId: string) => void
  let mockSelectConnection: (id: null) => void

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetPodPosition = vi.fn(() => ({ x: 100, y: 200 })) as () => { x: number; y: number }
    mockIsElementSelected = vi.fn(() => false) as unknown as (type: 'pod', id: string) => boolean
    mockEmit = vi.fn() as unknown as DragEmit
    mockSetSelectedElements = vi.fn() as unknown as (elements: SelectableElement[]) => void
    mockSetActivePod = vi.fn() as unknown as (podId: string) => void
    mockSelectConnection = vi.fn() as unknown as (id: null) => void
  })

  afterEach(() => {
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  function buildStores() {
    return {
      viewportStore: { zoom: 1 },
      selectionStore: { setSelectedElements: mockSetSelectedElements },
      podStore: { setActivePod: mockSetActivePod },
      connectionStore: { selectConnection: mockSelectConnection },
    }
  }

  function createComposable() {
    return usePodDrag(
      podId,
      mockGetPodPosition,
      mockIsElementSelected,
      mockEmit,
      buildStores()
    )
  }

  describe('startSingleDrag', () => {
    it('Pod 未被選取時，應呼叫 setSelectedElements 設定選取', () => {
      mockIsElementSelected = vi.fn(() => false) as unknown as (type: 'pod', id: string) => boolean

      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(mockSetSelectedElements).toHaveBeenCalledWith([{ type: 'pod', id: 'pod-1' }])
    })

    it('Pod 已被選取時，不應呼叫 setSelectedElements', () => {
      mockIsElementSelected = vi.fn(() => true) as unknown as (type: 'pod', id: string) => boolean

      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(mockSetSelectedElements).not.toHaveBeenCalled()
    })

    it('拖曳開始時應呼叫 podStore.setActivePod', () => {
      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(mockSetActivePod).toHaveBeenCalledWith('pod-1')
    })

    it('拖曳開始時應呼叫 connectionStore.selectConnection(null)', () => {
      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(mockSelectConnection).toHaveBeenCalledWith(null)
    })

    it('拖曳開始時應同時呼叫 setActivePod 和 selectConnection', () => {
      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 150 })
      startSingleDrag(event)

      expect(mockSetActivePod).toHaveBeenCalledTimes(1)
      expect(mockSelectConnection).toHaveBeenCalledTimes(1)
    })

    it('拖曳開始時應呼叫 getPodPosition 取得初始位置', () => {
      const { startSingleDrag } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(mockGetPodPosition).toHaveBeenCalled()
    })

    it('拖曳開始後 isDragging 應為 true', () => {
      const { startSingleDrag, isDragging } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(isDragging.value).toBe(true)
    })
  })

  describe('isDragging 狀態', () => {
    it('初始狀態 isDragging 應為 false', () => {
      const { isDragging } = createComposable()

      expect(isDragging.value).toBe(false)
    })

    it('mouseup 後 isDragging 應恢復為 false', () => {
      const { startSingleDrag, isDragging } = createComposable()
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50 })
      startSingleDrag(event)

      expect(isDragging.value).toBe(true)

      const mouseUpEvent = new MouseEvent('mouseup', { button: 0 })
      document.dispatchEvent(mouseUpEvent)

      expect(isDragging.value).toBe(false)
    })
  })
})
