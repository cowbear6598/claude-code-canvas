import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'

export function useBatchDrag(): {
  isBatchDragging: import('vue').Ref<boolean>
  startBatchDrag: (e: MouseEvent) => boolean
  isElementSelected: (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote', id: string) => boolean
} {
  const { podStore, viewportStore, selectionStore, outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore } = useCanvasContext()

  const isBatchDragging = ref(false)

  let startX = 0
  let startY = 0

  const movedPods = new Set<string>()
  const movedOutputStyleNotes = new Set<string>()
  const movedSkillNotes = new Set<string>()
  const movedRepositoryNotes = new Set<string>()
  const movedSubAgentNotes = new Set<string>()
  const movedCommandNotes = new Set<string>()

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

  const startBatchDrag = (e: MouseEvent): boolean => {
    if (e.button !== 0) return false

    if (!selectionStore.hasSelection) return false

    isBatchDragging.value = true
    startX = e.clientX
    startY = e.clientY

    movedPods.clear()
    movedOutputStyleNotes.clear()
    movedSkillNotes.clear()
    movedRepositoryNotes.clear()
    movedSubAgentNotes.clear()
    movedCommandNotes.clear()

    cleanupEventListeners()

    currentMoveHandler = (moveEvent: MouseEvent): void => {
      const dx = (moveEvent.clientX - startX) / viewportStore.zoom
      const dy = (moveEvent.clientY - startY) / viewportStore.zoom

      moveSelectedElements(dx, dy)

      startX = moveEvent.clientX
      startY = moveEvent.clientY
    }

    currentUpHandler = async (): Promise<void> => {
      isBatchDragging.value = false
      cleanupEventListeners()

      await syncElementsToBackend()
    }

    document.addEventListener('mousemove', currentMoveHandler)
    document.addEventListener('mouseup', currentUpHandler)

    return true
  }

  const moveSelectedElements = (dx: number, dy: number): void => {
    const storeConfigMap = {
      pod: {
        store: podStore,
        movedSet: movedPods,
        moveItem: (id: string, x: number, y: number) => podStore.movePod(id, x, y),
        getItem: (id: string) => podStore.pods.find(p => p.id === id),
        isPod: true
      },
      outputStyleNote: {
        store: outputStyleStore,
        movedSet: movedOutputStyleNotes,
        moveItem: (id: string, x: number, y: number) => outputStyleStore.updateNotePositionLocal(id, x, y),
        getItem: (id: string) => outputStyleStore.notes.find(n => n.id === id),
        isPod: false
      },
      skillNote: {
        store: skillStore,
        movedSet: movedSkillNotes,
        moveItem: (id: string, x: number, y: number) => skillStore.updateNotePositionLocal(id, x, y),
        getItem: (id: string) => skillStore.notes.find(n => n.id === id),
        isPod: false
      },
      repositoryNote: {
        store: repositoryStore,
        movedSet: movedRepositoryNotes,
        moveItem: (id: string, x: number, y: number) => repositoryStore.updateNotePositionLocal(id, x, y),
        getItem: (id: string) => repositoryStore.notes.find(n => n.id === id),
        isPod: false
      },
      subAgentNote: {
        store: subAgentStore,
        movedSet: movedSubAgentNotes,
        moveItem: (id: string, x: number, y: number) => subAgentStore.updateNotePositionLocal(id, x, y),
        getItem: (id: string) => subAgentStore.notes.find(n => n.id === id),
        isPod: false
      },
      commandNote: {
        store: commandStore,
        movedSet: movedCommandNotes,
        moveItem: (id: string, x: number, y: number) => commandStore.updateNotePositionLocal(id, x, y),
        getItem: (id: string) => commandStore.notes.find(n => n.id === id),
        isPod: false
      }
    } as const

    for (const element of selectionStore.selectedElements) {
      const config = storeConfigMap[element.type]
      if (!config) continue

      const item = config.getItem(element.id)
      if (!item) continue

      if (config.isPod) {
        config.moveItem(element.id, item.x + dx, item.y + dy)
        config.movedSet.add(element.id)
      } else {
        if (!item.boundToPodId) {
          config.moveItem(element.id, item.x + dx, item.y + dy)
          config.movedSet.add(element.id)
        }
      }
    }
  }

  const syncNotesByType = async <T extends { id?: string; x: number; y: number }>(
    movedNoteIds: Set<string>,
    store: {
      notes: T[]
      updateNotePosition: (noteId: string, x: number, y: number) => Promise<void>
    }
  ): Promise<void> => {
    for (const noteId of movedNoteIds) {
      const note = store.notes.find(n => n.id === noteId)
      if (note) {
        await store.updateNotePosition(noteId, note.x, note.y)
      }
    }
  }

  const syncElementsToBackend = async (): Promise<void> => {
    for (const podId of movedPods) {
      podStore.syncPodPosition(podId)
    }

    await syncNotesByType(movedOutputStyleNotes, outputStyleStore)
    await syncNotesByType(movedSkillNotes, skillStore)
    await syncNotesByType(movedRepositoryNotes, repositoryStore)
    await syncNotesByType(movedSubAgentNotes, subAgentStore)
    await syncNotesByType(movedCommandNotes, commandStore)

    movedPods.clear()
    movedOutputStyleNotes.clear()
    movedSkillNotes.clear()
    movedRepositoryNotes.clear()
    movedSubAgentNotes.clear()
    movedCommandNotes.clear()
  }

  const isElementSelected = (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote', id: string): boolean => {
    return selectionStore.selectedElements.some(
      el => el.type === type && el.id === id
    )
  }

  onUnmounted(() => {
    cleanupEventListeners()
  })

  return {
    isBatchDragging,
    startBatchDrag,
    isElementSelected
  }
}
