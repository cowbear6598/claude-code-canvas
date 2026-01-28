import type { Ref } from 'vue'

interface NoteStore {
  updateNotePositionLocal: (noteId: string, x: number, y: number) => void
  updateNotePosition: (noteId: string, x: number, y: number) => Promise<void>
  setIsOverTrash: (isOver: boolean) => void
  setNoteAnimating: (noteId: string, isAnimating: boolean) => void
  deleteNote: (noteId: string) => Promise<void>
  getNoteById: (noteId: string) => any
}

interface TrashZone {
  isPointInZone: (x: number, y: number) => boolean
}

interface NoteEventHandlerOptions {
  store: NoteStore
  trashZoneRef: Ref<TrashZone | null>
}

export function useNoteEventHandlers(options: NoteEventHandlerOptions) {
  const { store, trashZoneRef } = options

  const handleDragEnd = (data: { noteId: string; x: number; y: number }) => {
    store.updateNotePositionLocal(data.noteId, data.x, data.y)
  }

  const handleDragMove = (data: { noteId: string; screenX: number; screenY: number }) => {
    if (!trashZoneRef.value) return

    const isOver = trashZoneRef.value.isPointInZone(data.screenX, data.screenY)
    store.setIsOverTrash(isOver)
  }

  const handleDragComplete = async (data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }) => {
    const note = store.getNoteById(data.noteId)
    if (!note) return

    if (data.isOverTrash) {
      if (note.boundToPodId === null) {
        await store.deleteNote(data.noteId)
      } else {
        store.setNoteAnimating(data.noteId, true)
        await store.updateNotePosition(data.noteId, data.startX, data.startY)
        setTimeout(() => {
          store.setNoteAnimating(data.noteId, false)
        }, 300)
      }
    } else {
      await store.updateNotePosition(data.noteId, note.x, note.y)
    }

    store.setIsOverTrash(false)
  }

  return { handleDragEnd, handleDragMove, handleDragComplete }
}
