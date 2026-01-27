import { defineStore } from 'pinia'
import type { BaseNote } from '@/types'
import { createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'

export interface NoteStoreConfig<TItem> {
  storeName: string
  events: {
    listItems: { request: string; response: string }
    listNotes: { request: string; response: string }
    createNote: { request: string; response: string }
    updateNote: { request: string; response: string }
    deleteNote: { request: string; response: string }
  }
  createNotePayload: (item: TItem, x: number, y: number) => object
  getItemId: (item: TItem) => string
  getItemName: (item: TItem) => string
}

export interface BaseNoteState<TItem, TNote extends BaseNote> {
  availableItems: TItem[]
  notes: TNote[]
  isLoading: boolean
  error: string | null
  draggedNoteId: string | null
  animatingNoteIds: Set<string>
  isDraggingNote: boolean
  isOverTrash: boolean
}

export interface BaseNoteGetters<TNote extends BaseNote> {
  getUnboundNotes: TNote[]
  getNoteById: (noteId: string) => TNote | undefined
  isNoteAnimating: (noteId: string) => boolean
  canDeleteDraggedNote: boolean
}

export interface BaseNoteActions<TItem> {
  loadItems(): Promise<void>
  loadNotesFromBackend(): Promise<void>
  createNote(item: TItem, x: number, y: number): Promise<void>
  updateNotePositionLocal(noteId: string, x: number, y: number): void
  updateNotePosition(noteId: string, x: number, y: number): Promise<void>
  setDraggedNote(noteId: string | null): void
  setNoteAnimating(noteId: string, isAnimating: boolean): void
  setIsDraggingNote(isDragging: boolean): void
  setIsOverTrash(isOver: boolean): void
  deleteNote(noteId: string): Promise<void>
}

export function createNoteStore<TItem>(
  config: NoteStoreConfig<TItem>
) {
  return defineStore(config.storeName, {
    state: (): BaseNoteState<TItem, BaseNote> => ({
      availableItems: [],
      notes: [],
      isLoading: false,
      error: null,
      draggedNoteId: null,
      animatingNoteIds: new Set<string>(),
      isDraggingNote: false,
      isOverTrash: false,
    }),

    getters: {
      getUnboundNotes: (state): BaseNote[] =>
        state.notes.filter(note => note.boundToPodId === null),

      getNoteById: (state) => (noteId: string): BaseNote | undefined =>
        state.notes.find(note => note.id === noteId),

      isNoteAnimating: (state) => (noteId: string): boolean =>
        state.animatingNoteIds.has(noteId),

      canDeleteDraggedNote: (state): boolean => {
        if (state.draggedNoteId === null) return false
        const note = state.notes.find(n => n.id === state.draggedNoteId)
        return note?.boundToPodId === null
      },
    },

    actions: {
      async loadItems(): Promise<void> {
        this.isLoading = true
        this.error = null

        const { wrapWebSocketRequest } = useWebSocketErrorHandler()

        const response = await wrapWebSocketRequest(
          createWebSocketRequest<any, any>({
            requestEvent: config.events.listItems.request,
            responseEvent: config.events.listItems.response,
            payload: {}
          }),
          '載入項目失敗'
        )

        this.isLoading = false

        if (!response) {
          this.error = '載入失敗'
          return
        }

        if (response.styles) {
          this.availableItems = response.styles
        } else if (response.skills) {
          this.availableItems = response.skills
        }
      },

      async loadNotesFromBackend(): Promise<void> {
        this.isLoading = true
        this.error = null

        const { wrapWebSocketRequest } = useWebSocketErrorHandler()

        const response = await wrapWebSocketRequest(
          createWebSocketRequest<any, any>({
            requestEvent: config.events.listNotes.request,
            responseEvent: config.events.listNotes.response,
            payload: {}
          }),
          '載入筆記失敗'
        )

        this.isLoading = false

        if (!response) {
          this.error = '載入失敗'
          return
        }

        if (response.notes) {
          this.notes = response.notes
        }
      },

      async createNote(item: TItem, x: number, y: number): Promise<void> {
        const itemName = config.getItemName(item)

        const payload = {
          ...config.createNotePayload(item, x, y),
          name: itemName,
          x,
          y,
          boundToPodId: null,
          originalPosition: null,
        }

        const response = await createWebSocketRequest<any, any>({
          requestEvent: config.events.createNote.request,
          responseEvent: config.events.createNote.response,
          payload
        })

        if (response.note) {
          this.notes.push(response.note)
        }
      },

      updateNotePositionLocal(noteId: string, x: number, y: number): void {
        const note = this.notes.find(n => n.id === noteId)
        if (!note) return
        note.x = x
        note.y = y
      },

      async updateNotePosition(noteId: string, x: number, y: number): Promise<void> {
        const note = this.notes.find(n => n.id === noteId)
        if (!note) return

        const originalX = note.x
        const originalY = note.y

        note.x = x
        note.y = y

        const { wrapWebSocketRequest } = useWebSocketErrorHandler()

        const response = await wrapWebSocketRequest(
          createWebSocketRequest<any, any>({
            requestEvent: config.events.updateNote.request,
            responseEvent: config.events.updateNote.response,
            payload: {
              noteId,
              x,
              y,
            }
          }),
          '更新位置失敗'
        )

        if (!response) {
          note.x = originalX
          note.y = originalY
          return
        }

        if (response.note) {
          const index = this.notes.findIndex(n => n.id === noteId)
          if (index !== -1) {
            this.notes[index] = response.note
          }
        }
      },

      setDraggedNote(noteId: string | null): void {
        this.draggedNoteId = noteId
      },

      setNoteAnimating(noteId: string, isAnimating: boolean): void {
        if (isAnimating) {
          this.animatingNoteIds.add(noteId)
        } else {
          this.animatingNoteIds.delete(noteId)
        }
      },

      setIsDraggingNote(isDragging: boolean): void {
        this.isDraggingNote = isDragging
      },

      setIsOverTrash(isOver: boolean): void {
        this.isOverTrash = isOver
      },

      async deleteNote(noteId: string): Promise<void> {
        const index = this.notes.findIndex(n => n.id === noteId)
        if (index === -1) return

        const note = this.notes[index]
        if (!note) return

        const originalIndex = index
        this.notes.splice(index, 1)

        const { wrapWebSocketRequest } = useWebSocketErrorHandler()

        const response = await wrapWebSocketRequest(
          createWebSocketRequest<any, any>({
            requestEvent: config.events.deleteNote.request,
            responseEvent: config.events.deleteNote.response,
            payload: {
              noteId,
            }
          }),
          '刪除筆記失敗'
        )

        if (!response) {
          this.notes.splice(originalIndex, 0, note)
          return
        }
      },
    },
  })
}
