import { ref, onUnmounted } from 'vue'
import { useCanvasContext } from './useCanvasContext'

export function useBatchDrag(): {
  isBatchDragging: import('vue').Ref<boolean>
  startBatchDrag: (e: MouseEvent) => boolean
  isElementSelected: (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote' | 'trigger', id: string) => boolean
} {
  const { podStore, viewportStore, selectionStore, outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore, triggerStore } = useCanvasContext()

  const isBatchDragging = ref(false)

  let startX = 0
  let startY = 0

  const movedPods = new Set<string>()
  const movedOutputStyleNotes = new Set<string>()
  const movedSkillNotes = new Set<string>()
  const movedRepositoryNotes = new Set<string>()
  const movedSubAgentNotes = new Set<string>()
  const movedCommandNotes = new Set<string>()
  const movedTriggers = new Set<string>()

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
    movedTriggers.clear()

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
    for (const element of selectionStore.selectedElements) {
      if (element.type === 'pod') {
        const pod = podStore.pods.find(p => p.id === element.id)
        if (pod) {
          podStore.movePod(element.id, pod.x + dx, pod.y + dy)
          movedPods.add(element.id)
        }
      } else if (element.type === 'outputStyleNote') {
        const note = outputStyleStore.notes.find(n => n.id === element.id)
        if (note && !note.boundToPodId) {
          outputStyleStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          movedOutputStyleNotes.add(element.id)
        }
      } else if (element.type === 'skillNote') {
        const note = skillStore.notes.find(n => n.id === element.id)
        if (note && !note.boundToPodId) {
          skillStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          movedSkillNotes.add(element.id)
        }
      } else if (element.type === 'repositoryNote') {
        const note = repositoryStore.notes.find(n => n.id === element.id)
        if (note && !note.boundToPodId) {
          repositoryStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          movedRepositoryNotes.add(element.id)
        }
      } else if (element.type === 'subAgentNote') {
        const note = subAgentStore.notes.find(n => n.id === element.id)
        if (note && !note.boundToPodId) {
          subAgentStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          movedSubAgentNotes.add(element.id)
        }
      } else if (element.type === 'commandNote') {
        const note = commandStore.notes.find(n => n.id === element.id)
        if (note && !note.boundToPodId) {
          commandStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          movedCommandNotes.add(element.id)
        }
      } else if (element.type === 'trigger') {
        const trigger = triggerStore.triggers.find(t => t.id === element.id)
        if (trigger) {
          triggerStore.moveTrigger(element.id, trigger.x + dx, trigger.y + dy)
          movedTriggers.add(element.id)
        }
      }
    }
  }

  const syncElementsToBackend = async (): Promise<void> => {
    for (const podId of movedPods) {
      podStore.syncPodPosition(podId)
    }

    for (const noteId of movedOutputStyleNotes) {
      const note = outputStyleStore.notes.find(n => n.id === noteId)
      if (note) {
        await outputStyleStore.updateNotePosition(noteId, note.x, note.y)
      }
    }

    for (const noteId of movedSkillNotes) {
      const note = skillStore.notes.find(n => n.id === noteId)
      if (note) {
        await skillStore.updateNotePosition(noteId, note.x, note.y)
      }
    }

    for (const noteId of movedRepositoryNotes) {
      const note = repositoryStore.notes.find(n => n.id === noteId)
      if (note) {
        await repositoryStore.updateNotePosition(noteId, note.x, note.y)
      }
    }

    for (const noteId of movedSubAgentNotes) {
      const note = subAgentStore.notes.find(n => n.id === noteId)
      if (note) {
        await subAgentStore.updateNotePosition(noteId, note.x, note.y)
      }
    }

    for (const noteId of movedCommandNotes) {
      const note = commandStore.notes.find(n => n.id === noteId)
      if (note) {
        await commandStore.updateNotePosition(noteId, note.x, note.y)
      }
    }

    for (const triggerId of movedTriggers) {
      const trigger = triggerStore.triggers.find(t => t.id === triggerId)
      if (trigger) {
        await triggerStore.updateTrigger(triggerId, { x: trigger.x, y: trigger.y })
      }
    }

    movedPods.clear()
    movedOutputStyleNotes.clear()
    movedSkillNotes.clear()
    movedRepositoryNotes.clear()
    movedSubAgentNotes.clear()
    movedCommandNotes.clear()
    movedTriggers.clear()
  }

  const isElementSelected = (type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote' | 'trigger', id: string): boolean => {
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
