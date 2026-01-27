import { onMounted, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { useToast } from '@/composables/useToast'
import { isEditingElement } from '@/utils/domHelpers'

async function deleteSelectedElements(): Promise<void> {
  const { podStore, selectionStore, outputStyleStore, skillStore, repositoryStore } = useCanvasContext()
  const { toast } = useToast()

  const selectedElements = selectionStore.selectedElements
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

  const repositoryNotes = selectedElements
    .filter(el => el.type === 'repositoryNote')
    .map(el => el.id)

  const deletePromises: Promise<void>[] = []

  pods.forEach(id => {
    deletePromises.push(podStore.deletePodWithBackend(id))
  })

  outputStyleNotes.forEach(id => {
    deletePromises.push(outputStyleStore.deleteNote(id))
  })

  skillNotes.forEach(id => {
    deletePromises.push(skillStore.deleteNote(id))
  })

  repositoryNotes.forEach(id => {
    deletePromises.push(repositoryStore.deleteNote(id))
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

  selectionStore.clearSelection()
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Delete') return
  if (isEditingElement()) return

  const { selectionStore } = useCanvasContext()
  if (!selectionStore.hasSelection) return

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
