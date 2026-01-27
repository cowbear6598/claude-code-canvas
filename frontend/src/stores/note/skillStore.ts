import { defineStore } from 'pinia'
import type { Skill, SkillNote } from '@/types'
import type { BaseNoteState } from './createNoteStore'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import type {
  SkillListResultPayload,
  SkillNoteCreatedPayload,
  SkillNoteListResultPayload,
  SkillNoteUpdatedPayload,
  SkillNoteDeletedPayload,
  PodSkillBoundPayload,
  SkillListPayload,
  SkillNoteListPayload,
  SkillNoteCreatePayload,
  SkillNoteUpdatePayload,
  SkillNoteDeletePayload,
  PodBindSkillPayload
} from '@/types/websocket'

interface SkillState extends BaseNoteState<Skill, SkillNote> {
  availableItems: Skill[]
  notes: SkillNote[]
}

export const useSkillStore = defineStore('skill', {
  state: (): SkillState => ({
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
    availableSkills: (state): Skill[] => state.availableItems,

    getUnboundNotes: (state): SkillNote[] =>
      state.notes.filter(note => note.boundToPodId === null),

    getNotesByPodId: (state) => (podId: string): SkillNote[] =>
      state.notes.filter(note => note.boundToPodId === podId),

    getNoteById: (state) => (noteId: string): SkillNote | undefined =>
      state.notes.find(note => note.id === noteId),

    isNoteAnimating: (state) => (noteId: string): boolean =>
      state.animatingNoteIds.has(noteId),

    canDeleteDraggedNote: (state): boolean => {
      if (state.draggedNoteId === null) return false
      const note = state.notes.find(n => n.id === state.draggedNoteId)
      return note?.boundToPodId === null
    },

    getSkillCountByPodId: (state) => (podId: string): number =>
      state.notes.filter(note => note.boundToPodId === podId).length,

    isSkillBoundToPod: (state) => (skillId: string, podId: string): boolean =>
      state.notes.some(note => note.skillId === skillId && note.boundToPodId === podId),
  },

  actions: {
    async loadItems(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<SkillListPayload, SkillListResultPayload>({
          requestEvent: WebSocketRequestEvents.SKILL_LIST,
          responseEvent: WebSocketResponseEvents.SKILL_LIST_RESULT,
          payload: {}
        }),
        '載入 Skill 失敗'
      )

      this.isLoading = false

      if (!response) {
        this.error = '載入失敗'
        return
      }

      if (response.skills) {
        this.availableItems = response.skills
      }
    },

    async loadNotesFromBackend(): Promise<void> {
      this.isLoading = true
      this.error = null

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<SkillNoteListPayload, SkillNoteListResultPayload>({
          requestEvent: WebSocketRequestEvents.SKILL_NOTE_LIST,
          responseEvent: WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
          payload: {}
        }),
        '載入 Skill 筆記失敗'
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

    async createNote(skillId: string, x: number, y: number): Promise<void> {
      const skill = this.availableItems.find(s => s.id === skillId)
      if (!skill) return

      const response = await createWebSocketRequest<SkillNoteCreatePayload, SkillNoteCreatedPayload>({
        requestEvent: WebSocketRequestEvents.SKILL_NOTE_CREATE,
        responseEvent: WebSocketResponseEvents.SKILL_NOTE_CREATED,
        payload: {
          skillId,
          name: skill.name,
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
        createWebSocketRequest<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.SKILL_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
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
        createWebSocketRequest<PodBindSkillPayload, PodSkillBoundPayload>({
          requestEvent: WebSocketRequestEvents.POD_BIND_SKILL,
          responseEvent: WebSocketResponseEvents.POD_SKILL_BOUND,
          payload: {
            podId,
            skillId: note.skillId
          }
        }),
        createWebSocketRequest<SkillNoteUpdatePayload, SkillNoteUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.SKILL_NOTE_UPDATE,
          responseEvent: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
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
        createWebSocketRequest<SkillNoteDeletePayload, SkillNoteDeletedPayload>({
          requestEvent: WebSocketRequestEvents.SKILL_NOTE_DELETE,
          responseEvent: WebSocketResponseEvents.SKILL_NOTE_DELETED,
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

    // Backward compatibility alias
    async loadSkills(): Promise<void> {
      return this.loadItems()
    },
  },
})
