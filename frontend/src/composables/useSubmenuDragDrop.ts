import { ref } from 'vue'
import type { Ref } from 'vue'

interface UseSubmenuDragDropReturn {
  draggedItemId: Ref<string | null>
  dragOverGroupId: Ref<string | null>
  isDraggingOverRoot: Ref<boolean>
  handleDragStart: (itemId: string, event: DragEvent) => void
  handleDragEnd: () => void
  handleGroupDragOver: (groupId: string, event: DragEvent) => void
  handleGroupDragLeave: () => void
  handleGroupDrop: (groupId: string, event: DragEvent) => void
  handleRootDragOver: (event: DragEvent) => void
  handleRootDragLeave: () => void
  handleRootDrop: (event: DragEvent) => void
}

export function useSubmenuDragDrop(
  onItemDropToGroup: (itemId: string, groupId: string | null) => void
): UseSubmenuDragDropReturn {
  const draggedItemId = ref<string | null>(null)
  const dragOverGroupId = ref<string | null>(null)
  const isDraggingOverRoot = ref(false)

  const handleDragStart = (itemId: string, event: DragEvent): void => {
    draggedItemId.value = itemId
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', itemId)
    }
  }

  const handleDragEnd = (): void => {
    draggedItemId.value = null
    dragOverGroupId.value = null
    isDraggingOverRoot.value = false
  }

  const handleGroupDragOver = (groupId: string, event: DragEvent): void => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    dragOverGroupId.value = groupId
  }

  const handleGroupDragLeave = (): void => {
    dragOverGroupId.value = null
  }

  const handleGroupDrop = (groupId: string, event: DragEvent): void => {
    event.preventDefault()
    if (draggedItemId.value) {
      onItemDropToGroup(draggedItemId.value, groupId)
    }
    handleDragEnd()
  }

  const handleRootDragOver = (event: DragEvent): void => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    isDraggingOverRoot.value = true
  }

  const handleRootDragLeave = (): void => {
    isDraggingOverRoot.value = false
  }

  const handleRootDrop = (event: DragEvent): void => {
    event.preventDefault()
    if (draggedItemId.value) {
      onItemDropToGroup(draggedItemId.value, null)
    }
    handleDragEnd()
  }

  return {
    draggedItemId,
    dragOverGroupId,
    isDraggingOverRoot,
    handleDragStart,
    handleDragEnd,
    handleGroupDragOver,
    handleGroupDragLeave,
    handleGroupDrop,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop
  }
}
