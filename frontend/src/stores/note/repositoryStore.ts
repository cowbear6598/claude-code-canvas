import {defineStore} from 'pinia'
import type {Repository, RepositoryNote} from '@/types'
import type {BaseNoteState} from './createNoteStore'
import {createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import type {
  RepositoryListResultPayload,
  RepositoryCreatedPayload,
  RepositoryNoteCreatedPayload,
  RepositoryNoteListResultPayload,
  RepositoryNoteUpdatedPayload,
  RepositoryNoteDeletedPayload,
  PodRepositoryBoundPayload,
  PodRepositoryUnboundPayload,
  RepositoryListPayload,
  RepositoryCreatePayload,
  RepositoryNoteCreatePayload,
  RepositoryNoteListPayload,
  RepositoryNoteUpdatePayload,
  RepositoryNoteDeletePayload,
  PodBindRepositoryPayload,
  PodUnbindRepositoryPayload
} from '@/types/websocket'

interface RepositoryState extends BaseNoteState<Repository, RepositoryNote> {
  availableItems: Repository[]
  notes: RepositoryNote[]
}

export const useRepositoryStore = defineStore('repository', {
  state: (): RepositoryState => ({
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
    availableRepositories: (state): Repository[] => state.availableItems,

    getUnboundNotes: (state): RepositoryNote[] =>
      state.notes.filter(note => note.boundToPodId === null),

    getNoteByPodId: (state) => (podId: string): RepositoryNote | undefined =>
      state.notes.find(note => note.boundToPodId === podId),

    getNoteById: (state) => (noteId: string): RepositoryNote | undefined =>
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
    async loadRepositories(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryListPayload, RepositoryListResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_LIST,
          responseEvent: WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
          payload: {}
        }),
        '載入 Repository 失敗'
      )

      this.isLoading = false

      if (!response) {
        this.error = '載入失敗'
        return
      }

      if (!response.repositories) return

      this.availableItems = response.repositories
    },

    async createRepository(name: string): Promise<{ success: boolean; repository?: { id: string; name: string }; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCreatePayload, RepositoryCreatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CREATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
          payload: {name}
        }),
        '建立資料夾失敗'
      )

      if (!response) {
        return { success: false, error: '建立資料夾失敗' }
      }

      if (!response.repository) {
        return { success: false, error: response.error || '建立資料夾失敗' }
      }

      this.availableItems.push(response.repository)
      return { success: true, repository: response.repository }
    },

    async loadNotesFromBackend(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryNoteListPayload, RepositoryNoteListResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
          responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
          payload: {}
        }),
        '載入 Repository 筆記失敗'
      )

      this.isLoading = false

      if (!response) {
        this.error = '載入失敗'
        return
      }

      if (!response.notes) return

      this.notes = response.notes
    },

    async createNote(repositoryId: string, x: number, y: number): Promise<void> {
      const repository = this.availableItems.find(r => r.id === repositoryId)
      if (!repository) return

      const response = await createWebSocketRequest<RepositoryNoteCreatePayload, RepositoryNoteCreatedPayload>({
        requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
        responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
        payload: {
          repositoryId,
          name: repository.name,
          x,
          y,
          boundToPodId: null,
          originalPosition: null,
        }
      })

      if (!response.note) return

      this.notes.push(response.note)
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
        createWebSocketRequest<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
          payload: {noteId, x, y}
        }),
        '更新位置失敗'
      )

      if (!response) {
        note.x = originalX
        note.y = originalY
        return
      }

      if (!response.note) return

      const index = this.notes.findIndex(n => n.id === noteId)
      if (index === -1) return

      this.notes[index] = response.note
    },

    async bindToPod(noteId: string, podId: string): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      const existingNote = this.getNoteByPodId(podId)
      if (existingNote) {
        await this.unbindFromPod(podId, true)
      }

      const originalPosition = {x: note.x, y: note.y}

      const [, updateResponse] = await Promise.all([
        createWebSocketRequest<PodBindRepositoryPayload, PodRepositoryBoundPayload>({
          requestEvent: WebSocketRequestEvents.POD_BIND_REPOSITORY,
          responseEvent: WebSocketResponseEvents.POD_REPOSITORY_BOUND,
          payload: {podId, repositoryId: note.repositoryId}
        }),
        createWebSocketRequest<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
          payload: {noteId, boundToPodId: podId, originalPosition}
        })
      ])

      if (!updateResponse.note) return

      const index = this.notes.findIndex(n => n.id === noteId)
      if (index === -1) return

      this.notes[index] = updateResponse.note
    },

    async unbindFromPod(podId: string, returnToOriginal: boolean = false): Promise<void> {
      const note = this.notes.find(n => n.boundToPodId === podId)
      if (!note) return

      const noteId = note.id

      const updatePayload: {
        noteId: string
        boundToPodId: null
        originalPosition: null
        x?: number
        y?: number
      } = {
        noteId,
        boundToPodId: null,
        originalPosition: null,
      }

      if (returnToOriginal && note.originalPosition) {
        updatePayload.x = note.originalPosition.x
        updatePayload.y = note.originalPosition.y
      }

      const [, updateResponse] = await Promise.all([
        createWebSocketRequest<PodUnbindRepositoryPayload, PodRepositoryUnboundPayload>({
          requestEvent: WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
          responseEvent: WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
          payload: {podId}
        }),
        createWebSocketRequest<RepositoryNoteUpdatePayload, RepositoryNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
          payload: updatePayload
        })
      ])

      if (!updateResponse.note) return

      const index = this.notes.findIndex(n => n.id === noteId)
      if (index === -1) return

      this.notes[index] = updateResponse.note
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
        createWebSocketRequest<RepositoryNoteDeletePayload, RepositoryNoteDeletedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
          payload: {noteId}
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
