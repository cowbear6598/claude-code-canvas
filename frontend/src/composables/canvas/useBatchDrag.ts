import { useCanvasContext } from './useCanvasContext'
import { useDragHandler } from '@/composables/useDragHandler'

type NoteStore = {
  notes: { id?: string; x: number; y: number; boundToPodId?: string | null }[]
  updateNotePositionLocal: (id: string, x: number, y: number) => void
  updateNotePosition: (noteId: string, x: number, y: number) => Promise<void>
}

type StoreConfigEntry = {
  movedSet: Set<string>
  moveItem: (id: string, x: number, y: number) => void
  getItem: (id: string) => { x: number; y: number; boundToPodId?: string | null } | undefined
  isPod: boolean
}

function createStoreConfigMap(
  podStore: ReturnType<typeof useCanvasContext>['podStore'],
  outputStyleStore: NoteStore,
  skillStore: NoteStore,
  repositoryStore: NoteStore,
  subAgentStore: NoteStore,
  commandStore: NoteStore,
  movedPods: Set<string>,
  movedOutputStyleNotes: Set<string>,
  movedSkillNotes: Set<string>,
  movedRepositoryNotes: Set<string>,
  movedSubAgentNotes: Set<string>,
  movedCommandNotes: Set<string>
): Record<string, StoreConfigEntry> {
  return {
    pod: {
      movedSet: movedPods,
      moveItem: (id: string, x: number, y: number) => podStore.movePod(id, x, y),
      getItem: (id: string) => podStore.pods.find(p => p.id === id),
      isPod: true
    },
    outputStyleNote: {
      movedSet: movedOutputStyleNotes,
      moveItem: (id: string, x: number, y: number) => outputStyleStore.updateNotePositionLocal(id, x, y),
      getItem: (id: string) => outputStyleStore.notes.find(n => n.id === id),
      isPod: false
    },
    skillNote: {
      movedSet: movedSkillNotes,
      moveItem: (id: string, x: number, y: number) => skillStore.updateNotePositionLocal(id, x, y),
      getItem: (id: string) => skillStore.notes.find(n => n.id === id),
      isPod: false
    },
    repositoryNote: {
      movedSet: movedRepositoryNotes,
      moveItem: (id: string, x: number, y: number) => repositoryStore.updateNotePositionLocal(id, x, y),
      getItem: (id: string) => repositoryStore.notes.find(n => n.id === id),
      isPod: false
    },
    subAgentNote: {
      movedSet: movedSubAgentNotes,
      moveItem: (id: string, x: number, y: number) => subAgentStore.updateNotePositionLocal(id, x, y),
      getItem: (id: string) => subAgentStore.notes.find(n => n.id === id),
      isPod: false
    },
    commandNote: {
      movedSet: movedCommandNotes,
      moveItem: (id: string, x: number, y: number) => commandStore.updateNotePositionLocal(id, x, y),
      getItem: (id: string) => commandStore.notes.find(n => n.id === id),
      isPod: false
    }
  }
}

export function useBatchDrag(): {
  isBatchDragging: import('vue').Ref<boolean>
  startBatchDrag: (e: MouseEvent) => boolean
  isElementSelected: (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote' | 'mcpServerNote', id: string) => boolean
} {
  const { podStore, viewportStore, selectionStore, outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore } = useCanvasContext()

  let startX = 0
  let startY = 0

  const movedPods = new Set<string>()
  const movedOutputStyleNotes = new Set<string>()
  const movedSkillNotes = new Set<string>()
  const movedRepositoryNotes = new Set<string>()
  const movedSubAgentNotes = new Set<string>()
  const movedCommandNotes = new Set<string>()

  const noteMovedSets: { set: Set<string>; store: NoteStore }[] = [
    { set: movedOutputStyleNotes, store: outputStyleStore },
    { set: movedSkillNotes, store: skillStore },
    { set: movedRepositoryNotes, store: repositoryStore },
    { set: movedSubAgentNotes, store: subAgentStore },
    { set: movedCommandNotes, store: commandStore },
  ]

  const { isDragging: isBatchDragging, startDrag } = useDragHandler({
    onMove: (moveEvent: MouseEvent): void => {
      const deltaXInCanvasCoords = (moveEvent.clientX - startX) / viewportStore.zoom
      const deltaYInCanvasCoords = (moveEvent.clientY - startY) / viewportStore.zoom

      moveSelectedElements(deltaXInCanvasCoords, deltaYInCanvasCoords)

      startX = moveEvent.clientX
      startY = moveEvent.clientY
    },
    onEnd: async (): Promise<void> => {
      await syncElementsToBackend()
    }
  })

  const startBatchDrag = (e: MouseEvent): boolean => {
    if (e.button !== 0) return false

    if (!selectionStore.hasSelection) return false

    startX = e.clientX
    startY = e.clientY

    movedPods.clear()
    for (const { set } of noteMovedSets) {
      set.clear()
    }

    startDrag(e)

    return true
  }

  const movePodElement = (config: StoreConfigEntry, id: string, item: { x: number; y: number }, dx: number, dy: number): void => {
    config.moveItem(id, item.x + dx, item.y + dy)
    config.movedSet.add(id)
  }

  const moveNoteElement = (config: StoreConfigEntry, id: string, item: { x: number; y: number; boundToPodId?: string | null }, dx: number, dy: number): void => {
    if (item.boundToPodId) return
    config.moveItem(id, item.x + dx, item.y + dy)
    config.movedSet.add(id)
  }

  const moveSelectedElements = (dx: number, dy: number): void => {
    const storeConfigMap = createStoreConfigMap(
      podStore,
      outputStyleStore,
      skillStore,
      repositoryStore,
      subAgentStore,
      commandStore,
      movedPods,
      movedOutputStyleNotes,
      movedSkillNotes,
      movedRepositoryNotes,
      movedSubAgentNotes,
      movedCommandNotes
    )

    for (const element of selectionStore.selectedElements) {
      const config = storeConfigMap[element.type]
      if (!config) continue

      const item = config.getItem(element.id)
      if (!item) continue

      if (config.isPod) {
        movePodElement(config, element.id, item, dx, dy)
      } else {
        moveNoteElement(config, element.id, item, dx, dy)
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

    for (const { set, store } of noteMovedSets) {
      await syncNotesByType(set, store)
    }

    movedPods.clear()
    for (const { set } of noteMovedSets) {
      set.clear()
    }
  }

  const isElementSelected = (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote' | 'mcpServerNote', id: string): boolean => {
    return selectionStore.selectedElements.some(
      el => el.type === type && el.id === id
    )
  }

  return {
    isBatchDragging,
    startBatchDrag,
    isElementSelected
  }
}
