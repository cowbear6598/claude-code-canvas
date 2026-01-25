import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import { useSkillStore } from '@/stores/skillStore'
import { useToast } from '@/composables/useToast'

function isEditingElement(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }

  return activeElement.getAttribute('contenteditable') === 'true';
}

async function deleteSelectedElements(): Promise<void> {
  const canvasStore = useCanvasStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const { toast } = useToast()

  const selectedElements = canvasStore.selection.selectedElements
  if (selectedElements.length === 0) return

  const pods = selectedElements
    .filter(el => el.type === 'pod')
    .map(el => el.id)

  const outputStyleNotes = selectedElements
    .filter(el => el.type === 'outputStyleNote')
    .map(el => el.id)

  const skillNotes = selectedElements
    .filter(el => el.type === 'skillNote')
    .map(el => el.id)

  const deletePromises: Promise<void>[] = []

  pods.forEach(id => {
    deletePromises.push(canvasStore.deletePodWithBackend(id))
  })

  outputStyleNotes.forEach(id => {
    deletePromises.push(outputStyleStore.deleteNote(id))
  })

  skillNotes.forEach(id => {
    deletePromises.push(skillStore.deleteNote(id))
  })

  const results = await Promise.allSettled(deletePromises)

  const failedCount = results.filter(r => r.status === 'rejected').length

  if (failedCount > 0) {
    toast({
      title: '刪除部分失敗',
      description: `${failedCount} 個物件刪除失敗`,
      duration: 3000
    })
  }

  canvasStore.clearSelection()
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Delete') return
  if (isEditingElement()) return

  const canvasStore = useCanvasStore()
  if (!canvasStore.hasSelection) return

  deleteSelectedElements()
}

export function useDeleteSelection() {
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    deleteSelectedElements
  }
}
