import { defineStore } from 'pinia'
import type { SubAgent, SubAgentNote } from '@/types'
import type { BaseNoteState } from './createNoteStore'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useDeleteItem } from '@/composables/useDeleteItem'
import type {
  SubAgentListResultPayload,
  SubAgentDeletedPayload,
  SubAgentNoteCreatedPayload,
  SubAgentNoteListResultPayload,
  SubAgentNoteUpdatedPayload,
  SubAgentNoteDeletedPayload,
  PodSubAgentBoundPayload,
  SubAgentListPayload,
  SubAgentDeletePayload,
  SubAgentNoteListPayload,
  SubAgentNoteCreatePayload,
  SubAgentNoteUpdatePayload,
  SubAgentNoteDeletePayload,
  PodBindSubAgentPayload
} from '@/types/websocket'

interface SubAgentState extends BaseNoteState<SubAgent, SubAgentNote> {
  availableItems: SubAgent[]
  notes: SubAgentNote[]
}

export const useSubAgentStore = defineStore('subAgent', {
  state: (): SubAgentState => ({
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
    // Backward compatibility alias
    availableSubAgents: (state): SubAgent[] => state.availableItems,

    getUnboundNotes: (state): SubAgentNote[] =>
      state.notes.filter(note => note.boundToPodId === null),

    getNotesByPodId: (state) => (podId: string): SubAgentNote[] =>
      state.notes.filter(note => note.boundToPodId === podId),

    getNoteById: (state) => (noteId: string): SubAgentNote | undefined =>
      state.notes.find(note => note.id === noteId),

    isNoteAnimating: (state) => (noteId: string): boolean =>
      state.animatingNoteIds.has(noteId),

    canDeleteDraggedNote: (state): boolean => {
      if (state.draggedNoteId === null) return false
      const note = state.notes.find(n => n.id === state.draggedNoteId)
      return note?.boundToPodId === null
    },

    getSubAgentCountByPodId: (state) => (podId: string): number =>
      state.notes.filter(note => note.boundToPodId === podId).length,

    isSubAgentBoundToPod: (state) => (subAgentId: string, podId: string): boolean =>
      state.notes.some(note => note.subAgentId === subAgentId && note.boundToPodId === podId),

    isSubAgentInUse: (state) => (subAgentId: string): boolean =>
      state.notes.some(note => note.subAgentId === subAgentId && note.boundToPodId !== null),
  },

  actions: {
    async loadItems(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<SubAgentListPayload, SubAgentListResultPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_LIST,
          responseEvent: WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
          payload: {}
        }),
        '載入 SubAgent 失敗'
      )

      this.isLoading = false

      if (!response) {
        this.error = '載入失敗'
        return
      }

      if (response.subAgents) {
        this.availableItems = response.subAgents
      }
    },

    async loadNotesFromBackend(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<SubAgentNoteListPayload, SubAgentNoteListResultPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
          responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
          payload: {}
        }),
        '載入 SubAgent 筆記失敗'
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

    async createNote(subAgentId: string, x: number, y: number): Promise<void> {
      const subAgent = this.availableItems.find(s => s.id === subAgentId)
      if (!subAgent) return

      const response = await createWebSocketRequest<SubAgentNoteCreatePayload, SubAgentNoteCreatedPayload>({
        requestEvent: WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
        responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
        payload: {
          subAgentId,
          name: subAgent.name,
          x,
          y,
          boundToPodId: null,
          originalPosition: null,
        }
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
        createWebSocketRequest<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
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

    async bindToPod(noteId: string, podId: string): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      const originalPosition = { x: note.x, y: note.y }

      const [, updateResponse] = await Promise.all([
        createWebSocketRequest<PodBindSubAgentPayload, PodSubAgentBoundPayload>({
          requestEvent: WebSocketRequestEvents.POD_BIND_SUBAGENT,
          responseEvent: WebSocketResponseEvents.POD_SUBAGENT_BOUND,
          payload: {
            podId,
            subAgentId: note.subAgentId
          }
        }),
        createWebSocketRequest<SubAgentNoteUpdatePayload, SubAgentNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
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
        createWebSocketRequest<SubAgentNoteDeletePayload, SubAgentNoteDeletedPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
          responseEvent: WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
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

    async deleteSubAgent(subAgentId: string): Promise<void> {
      const { deleteItem } = useDeleteItem()

      await deleteItem<Omit<SubAgentDeletePayload, 'requestId'>, SubAgentDeletedPayload>({
        requestEvent: WebSocketRequestEvents.SUBAGENT_DELETE,
        responseEvent: WebSocketResponseEvents.SUBAGENT_DELETED,
        payload: { subAgentId },
        errorMessage: '刪除 SubAgent 失敗',
        onSuccess: (res) => {
          const index = this.availableItems.findIndex(s => s.id === subAgentId)
          if (index !== -1) {
            this.availableItems.splice(index, 1)
          }

          if (res.deletedNoteIds) {
            this.notes = this.notes.filter(note => !res.deletedNoteIds!.includes(note.id))
          }
        }
      })
    },

    // Backward compatibility alias
    async loadSubAgents(): Promise<void> {
      return this.loadItems()
    },
  },
})
