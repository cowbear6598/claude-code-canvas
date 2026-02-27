import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSubmenuDragDrop } from '@/composables/useSubmenuDragDrop'

function createMockDragEvent(type: string): DragEvent {
  const internalData: Record<string, string> = {}
  const dataTransfer = {
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    items: [] as unknown as DataTransferItemList,
    types: [] as readonly string[],
    files: [] as unknown as FileList,
    setData: vi.fn((format: string, data: string) => {
      internalData[format] = data
    }),
    getData: vi.fn((format: string) => internalData[format] ?? ''),
    clearData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer

  return {
    type,
    dataTransfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragEvent
}

describe('useSubmenuDragDrop', () => {
  let onItemDropToGroup: ReturnType<typeof vi.fn>

  function getMockCallback(): (itemId: string, groupId: string | null) => void {
    return onItemDropToGroup as unknown as (itemId: string, groupId: string | null) => void
  }

  beforeEach(() => {
    onItemDropToGroup = vi.fn()
  })

  describe('拖曳項目到群組', () => {
    it('開始拖曳 → 經過群組 → 放下 → 觸發 moveToGroup', () => {
      const { handleDragStart, handleGroupDragOver, handleGroupDrop, draggedItemId, dragOverGroupId } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)
      expect(draggedItemId.value).toBe('item-1')

      const overEvent = createMockDragEvent('dragover')
      handleGroupDragOver('group-1', overEvent)
      expect(dragOverGroupId.value).toBe('group-1')

      const dropEvent = createMockDragEvent('drop')
      handleGroupDrop('group-1', dropEvent)
      expect(onItemDropToGroup).toHaveBeenCalledWith('item-1', 'group-1')
    })

    it('放下後所有狀態重置', () => {
      const { handleDragStart, handleGroupDrop, draggedItemId, dragOverGroupId, isDraggingOverRoot } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)

      const dropEvent = createMockDragEvent('drop')
      handleGroupDrop('group-1', dropEvent)

      expect(draggedItemId.value).toBe(null)
      expect(dragOverGroupId.value).toBe(null)
      expect(isDraggingOverRoot.value).toBe(false)
    })
  })

  describe('拖曳項目到根層級', () => {
    it('開始拖曳 → 經過根層級 → 放下 → 觸發 moveToRoot', () => {
      const { handleDragStart, handleRootDragOver, handleRootDrop, draggedItemId, isDraggingOverRoot } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)
      expect(draggedItemId.value).toBe('item-1')

      const overEvent = createMockDragEvent('dragover')
      handleRootDragOver(overEvent)
      expect(isDraggingOverRoot.value).toBe(true)

      const dropEvent = createMockDragEvent('drop')
      handleRootDrop(dropEvent)
      expect(onItemDropToGroup).toHaveBeenCalledWith('item-1', null)
    })

    it('放下後所有狀態重置', () => {
      const { handleDragStart, handleRootDrop, draggedItemId, dragOverGroupId, isDraggingOverRoot } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)

      const dropEvent = createMockDragEvent('drop')
      handleRootDrop(dropEvent)

      expect(draggedItemId.value).toBe(null)
      expect(dragOverGroupId.value).toBe(null)
      expect(isDraggingOverRoot.value).toBe(false)
    })
  })

  describe('拖曳取消', () => {
    it('dragEnd 後所有狀態重置', () => {
      const { handleDragStart, handleGroupDragOver, handleRootDragOver, handleDragEnd, draggedItemId, dragOverGroupId, isDraggingOverRoot } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)

      const overEvent = createMockDragEvent('dragover')
      handleGroupDragOver('group-1', overEvent)
      handleRootDragOver(overEvent)

      handleDragEnd()

      expect(draggedItemId.value).toBe(null)
      expect(dragOverGroupId.value).toBe(null)
      expect(isDraggingOverRoot.value).toBe(false)
    })
  })

  describe('拖曳視覺狀態', () => {
    it('dragOverGroupId 切換', () => {
      const { handleGroupDragOver, handleGroupDragLeave, dragOverGroupId } = useSubmenuDragDrop(getMockCallback())

      const overEvent = createMockDragEvent('dragover')
      handleGroupDragOver('group-1', overEvent)
      expect(dragOverGroupId.value).toBe('group-1')

      handleGroupDragLeave()
      expect(dragOverGroupId.value).toBe(null)
    })

    it('isDraggingOverRoot 切換', () => {
      const { handleRootDragOver, handleRootDragLeave, isDraggingOverRoot } = useSubmenuDragDrop(getMockCallback())

      const overEvent = createMockDragEvent('dragover')
      handleRootDragOver(overEvent)
      expect(isDraggingOverRoot.value).toBe(true)

      handleRootDragLeave()
      expect(isDraggingOverRoot.value).toBe(false)
    })
  })

  describe('DragEvent dataTransfer 處理', () => {
    it('handleDragStart 設定 dataTransfer', () => {
      const { handleDragStart } = useSubmenuDragDrop(getMockCallback())

      const startEvent = createMockDragEvent('dragstart')
      handleDragStart('item-1', startEvent)

      expect(startEvent.dataTransfer!.effectAllowed).toBe('move')
      expect(startEvent.dataTransfer!.getData('text/plain')).toBe('item-1')
    })

    it('handleGroupDragOver 設定 dropEffect', () => {
      const { handleGroupDragOver } = useSubmenuDragDrop(getMockCallback())

      const overEvent = createMockDragEvent('dragover')
      handleGroupDragOver('group-1', overEvent)

      expect(overEvent.dataTransfer!.dropEffect).toBe('move')
    })

    it('handleRootDragOver 設定 dropEffect', () => {
      const { handleRootDragOver } = useSubmenuDragDrop(getMockCallback())

      const overEvent = createMockDragEvent('dragover')
      handleRootDragOver(overEvent)

      expect(overEvent.dataTransfer!.dropEffect).toBe('move')
    })
  })

  describe('無拖曳項目時的處理', () => {
    it('無拖曳項目放下群組時不觸發回調', () => {
      const { handleGroupDrop } = useSubmenuDragDrop(getMockCallback())

      const dropEvent = createMockDragEvent('drop')
      handleGroupDrop('group-1', dropEvent)

      expect(onItemDropToGroup).not.toHaveBeenCalled()
    })

    it('無拖曳項目放下根層級時不觸發回調', () => {
      const { handleRootDrop } = useSubmenuDragDrop(getMockCallback())

      const dropEvent = createMockDragEvent('drop')
      handleRootDrop(dropEvent)

      expect(onItemDropToGroup).not.toHaveBeenCalled()
    })
  })
})
