import { defineStore } from 'pinia'
import type { BaseNote } from '@/types'
import { createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useDeleteItem } from '@/composables/useDeleteItem'

export interface NoteStoreConfig<TItem, TNote extends BaseNote> {
  storeName: string
  relationship: 'one-to-one' | 'one-to-many'
  responseItemsKey: string
  itemIdField: string
  events: {
    listItems: { request: string; response: string }
    listNotes: { request: string; response: string }
    createNote: { request: string; response: string }
    updateNote: { request: string; response: string }
    deleteNote: { request: string; response: string }
  }
  bindEvents?: {
    request: string
    response: string
  }
  unbindEvents?: {
    request: string
    response: string
  }
  deleteItemEvents?: {
    request: string
    response: string
  }
  createNotePayload: (item: TItem, x: number, y: number) => object
  getItemId: (item: TItem) => string
  getItemName: (item: TItem) => string
  customActions?: Record<string, Function>
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

export interface BaseNoteGetters<TItem, TNote extends BaseNote> {
  getUnboundNotes: TNote[]
  getNotesByPodId: (podId: string) => TNote[]
  getNoteById: (noteId: string) => TNote | undefined
  isNoteAnimating: (noteId: string) => boolean
  canDeleteDraggedNote: boolean
  isItemInUse: (itemId: string) => boolean
  isItemBoundToPod?: (itemId: string, podId: string) => boolean
}

export interface BaseNoteActions<TItem> {
  loadItems(): Promise<void>
  loadNotesFromBackend(): Promise<void>
  createNote(itemId: string, x: number, y: number): Promise<void>
  updateNotePositionLocal(noteId: string, x: number, y: number): void
  updateNotePosition(noteId: string, x: number, y: number): Promise<void>
  bindToPod(noteId: string, podId: string): Promise<void>
  unbindFromPod?(podId: string, returnToOriginal?: boolean): Promise<void>
  setDraggedNote(noteId: string | null): void
  setNoteAnimating(noteId: string, isAnimating: boolean): void
  setIsDraggingNote(isDragging: boolean): void
  setIsOverTrash(isOver: boolean): void
  deleteNote(noteId: string): Promise<void>
  deleteItem?(itemId: string): Promise<void>
}

export function createNoteStore<TItem, TNote extends BaseNote>(
  config: NoteStoreConfig<TItem, TNote>
) {
  return defineStore(config.storeName, {
    state: (): BaseNoteState<TItem, TNote> => ({
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
      getUnboundNotes: (state): TNote[] =>
        state.notes.filter(note => note.boundToPodId === null),

      getNotesByPodId: (state) => (podId: string): TNote[] => {
        if (config.relationship === 'one-to-one') {
          const note = state.notes.find(note => note.boundToPodId === podId)
          return note ? [note] : []
        }
        return state.notes.filter(note => note.boundToPodId === podId)
      },

      getNoteById: (state) => (noteId: string): TNote | undefined =>
        state.notes.find(note => note.id === noteId),

      isNoteAnimating: (state) => (noteId: string): boolean =>
        state.animatingNoteIds.has(noteId),

      canDeleteDraggedNote: (state): boolean => {
        if (state.draggedNoteId === null) return false
        const note = state.notes.find(n => n.id === state.draggedNoteId)
        return note?.boundToPodId === null
      },

      isItemInUse: (state) => (itemId: string): boolean =>
        state.notes.some(note => (note as any)[config.itemIdField] === itemId && note.boundToPodId !== null),

      isItemBoundToPod: config.relationship === 'one-to-many'
        ? (state) => (itemId: string, podId: string): boolean =>
            state.notes.some(note => (note as any)[config.itemIdField] === itemId && note.boundToPodId === podId)
        : undefined,
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

        if (response[config.responseItemsKey]) {
          this.availableItems = response[config.responseItemsKey]
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

      async createNote(itemId: string, x: number, y: number): Promise<void> {
        const item = this.availableItems.find(i => config.getItemId(i) === itemId)
        if (!item) return

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

      async bindToPod(noteId: string, podId: string): Promise<void> {
        const note = this.notes.find(n => n.id === noteId)
        if (!note) return

        if (config.relationship === 'one-to-one') {
          const existingNotes = this.getNotesByPodId(podId)
          if (existingNotes.length > 0 && config.unbindEvents) {
            await this.unbindFromPod!(podId, true)
          }
        }

        const originalPosition = { x: note.x, y: note.y }

        if (!config.bindEvents) return

        const [, updateResponse] = await Promise.all([
          createWebSocketRequest<any, any>({
            requestEvent: config.bindEvents.request,
            responseEvent: config.bindEvents.response,
            payload: {
              podId,
              [config.itemIdField]: (note as any)[config.itemIdField]
            }
          }),
          createWebSocketRequest<any, any>({
            requestEvent: config.events.updateNote.request,
            responseEvent: config.events.updateNote.response,
            payload: {
              noteId,
              boundToPodId: podId,
              originalPosition,
            }
          })
        ])

        if (updateResponse.note) {
          const index = this.notes.findIndex(n => n.id === noteId)
          if (index !== -1) {
            this.notes[index] = updateResponse.note
          }
        }
      },

      async unbindFromPod(podId: string, returnToOriginal: boolean = false): Promise<void> {
        if (!config.unbindEvents || config.relationship !== 'one-to-one') return

        const notes = this.getNotesByPodId(podId)
        if (notes.length === 0) return

        const note = notes[0]
        const noteId = note.id

        const updatePayload: any = {
          noteId,
          boundToPodId: null,
          originalPosition: null,
        }

        if (returnToOriginal && note.originalPosition) {
          updatePayload.x = note.originalPosition.x
          updatePayload.y = note.originalPosition.y
        }

        const [, updateResponse] = await Promise.all([
          createWebSocketRequest<any, any>({
            requestEvent: config.unbindEvents.request,
            responseEvent: config.unbindEvents.response,
            payload: { podId }
          }),
          createWebSocketRequest<any, any>({
            requestEvent: config.events.updateNote.request,
            responseEvent: config.events.updateNote.response,
            payload: updatePayload
          })
        ])

        if (updateResponse.note) {
          const index = this.notes.findIndex(n => n.id === noteId)
          if (index !== -1) {
            this.notes[index] = updateResponse.note
          }
        }
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

      async deleteItem(itemId: string): Promise<void> {
        if (!config.deleteItemEvents) return

        const { deleteItem } = useDeleteItem()

        await deleteItem<any, any>({
          requestEvent: config.deleteItemEvents.request,
          responseEvent: config.deleteItemEvents.response,
          payload: { [config.itemIdField]: itemId },
          errorMessage: '刪除項目失敗',
          onSuccess: (res) => {
            const index = this.availableItems.findIndex(item => config.getItemId(item) === itemId)
            if (index !== -1) {
              this.availableItems.splice(index, 1)
            }

            if (res.deletedNoteIds) {
              this.notes = this.notes.filter(note => !res.deletedNoteIds!.includes(note.id))
            }
          }
        })
      },

      ...(config.customActions || {})
    },
  })
}
