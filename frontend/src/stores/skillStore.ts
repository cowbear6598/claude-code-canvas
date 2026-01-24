import { defineStore } from 'pinia'
import type { Skill, SkillNote } from '@/types'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type {
  SkillListResultPayload,
  SkillNoteCreatedPayload,
  SkillNoteListResultPayload,
  SkillNoteUpdatedPayload,
  SkillNoteDeletedPayload,
  PodSkillBoundPayload
} from '@/types/websocket'

interface SkillState {
  availableSkills: Skill[]
  notes: SkillNote[]
  isLoading: boolean
  error: string | null
  draggedNoteId: string | null
  animatingNoteIds: Set<string>
  isDraggingNote: boolean
  isOverTrash: boolean
}

export const useSkillStore = defineStore('skill', {
  state: (): SkillState => ({
    availableSkills: [],
    notes: [],
    isLoading: false,
    error: null,
    draggedNoteId: null,
    animatingNoteIds: new Set<string>(),
    isDraggingNote: false,
    isOverTrash: false,
  }),

  getters: {
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
    async loadSkills(): Promise<void> {
      const requestId = generateRequestId()
      this.isLoading = true
      this.error = null

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          websocketService.offSkillListResult(handleSkillListResult)
          this.isLoading = false
          reject(new Error('Skill list timeout'))
        }, 10000)

        const handleSkillListResult = (payload: SkillListResultPayload) => {
          if (payload.requestId !== requestId) return

          clearTimeout(timeoutId)
          websocketService.offSkillListResult(handleSkillListResult)

          if (payload.success && payload.skills) {
            this.availableSkills = payload.skills
            this.isLoading = false
            resolve()
          } else {
            this.error = payload.error || 'Failed to load skills'
            this.isLoading = false
            reject(new Error(this.error))
          }
        }

        websocketService.onSkillListResult(handleSkillListResult)
        websocketService.skillList({ requestId })
      })
    },

    async loadNotesFromBackend(): Promise<void> {
      const requestId = generateRequestId()
      this.isLoading = true
      this.error = null

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          websocketService.offSkillNoteListResult(handleSkillNoteListResult)
          this.isLoading = false
          reject(new Error('Load skill notes timeout'))
        }, 10000)

        const handleSkillNoteListResult = (payload: SkillNoteListResultPayload) => {
          if (payload.requestId !== requestId) return

          clearTimeout(timeoutId)
          websocketService.offSkillNoteListResult(handleSkillNoteListResult)

          if (payload.success && payload.notes) {
            this.notes = payload.notes
            this.isLoading = false
            resolve()
          } else {
            this.error = payload.error || 'Failed to load skill notes'
            this.isLoading = false
            reject(new Error(this.error))
          }
        }

        websocketService.onSkillNoteListResult(handleSkillNoteListResult)
        websocketService.skillNoteList({ requestId })
      })
    },

    async createNote(skillId: string, x: number, y: number): Promise<void> {
      const skill = this.availableSkills.find(s => s.id === skillId)
      if (!skill) return

      const requestId = generateRequestId()

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          websocketService.offSkillNoteCreated(handleSkillNoteCreated)
          reject(new Error('Create skill note timeout'))
        }, 10000)

        const handleSkillNoteCreated = (payload: SkillNoteCreatedPayload) => {
          if (payload.requestId !== requestId) return

          clearTimeout(timeoutId)
          websocketService.offSkillNoteCreated(handleSkillNoteCreated)

          if (payload.success && payload.note) {
            this.notes.push(payload.note)
            resolve()
          } else {
            reject(new Error(payload.error || 'Failed to create skill note'))
          }
        }

        websocketService.onSkillNoteCreated(handleSkillNoteCreated)
        websocketService.skillNoteCreate({
          requestId,
          skillId,
          name: skill.name,
          x,
          y,
          boundToPodId: null,
          originalPosition: null,
        })
      })
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
      const requestId = generateRequestId()

      note.x = x
      note.y = y

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          websocketService.offSkillNoteUpdated(handleSkillNoteUpdated)
          note.x = originalX
          note.y = originalY
          reject(new Error('Update skill note timeout'))
        }, 10000)

        const handleSkillNoteUpdated = (payload: SkillNoteUpdatedPayload) => {
          if (payload.requestId !== requestId) return

          clearTimeout(timeoutId)
          websocketService.offSkillNoteUpdated(handleSkillNoteUpdated)

          if (payload.success && payload.note) {
            const index = this.notes.findIndex(n => n.id === noteId)
            if (index !== -1) {
              this.notes[index] = payload.note
            }
            resolve()
          } else {
            note.x = originalX
            note.y = originalY
            reject(new Error(payload.error || 'Failed to update skill note'))
          }
        }

        websocketService.onSkillNoteUpdated(handleSkillNoteUpdated)
        websocketService.skillNoteUpdate({
          requestId,
          noteId,
          x,
          y,
        })
      })
    },

    async bindToPod(noteId: string, podId: string): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      const requestId = generateRequestId()
      const originalPosition = { x: note.x, y: note.y }

      return new Promise((resolve, reject) => {
        let podBound = false
        let noteUpdated = false

        const checkComplete = () => {
          if (podBound && noteUpdated) {
            clearTimeout(timeoutId)
            resolve()
          }
        }

        const cleanup = () => {
          websocketService.offPodSkillBound(handlePodSkillBound)
          websocketService.offSkillNoteUpdated(handleSkillNoteUpdated)
        }

        const timeoutId = setTimeout(() => {
          cleanup()
          reject(new Error('Bind operation timeout'))
        }, 10000)

        const handlePodSkillBound = (payload: PodSkillBoundPayload) => {
          if (payload.requestId !== requestId) return

          websocketService.offPodSkillBound(handlePodSkillBound)

          if (payload.success) {
            podBound = true
            checkComplete()
          } else {
            cleanup()
            clearTimeout(timeoutId)
            reject(new Error(payload.error || 'Failed to bind skill'))
          }
        }

        const handleSkillNoteUpdated = (payload: SkillNoteUpdatedPayload) => {
          if (payload.requestId !== requestId) return

          websocketService.offSkillNoteUpdated(handleSkillNoteUpdated)

          if (payload.success && payload.note) {
            const index = this.notes.findIndex(n => n.id === noteId)
            if (index !== -1) {
              this.notes[index] = payload.note
            }
            noteUpdated = true
            checkComplete()
          } else {
            cleanup()
            clearTimeout(timeoutId)
            reject(new Error(payload.error || 'Failed to update skill note'))
          }
        }

        websocketService.onPodSkillBound(handlePodSkillBound)
        websocketService.onSkillNoteUpdated(handleSkillNoteUpdated)

        websocketService.podBindSkill({
          requestId,
          podId,
          skillId: note.skillId
        })

        websocketService.skillNoteUpdate({
          requestId,
          noteId,
          boundToPodId: podId,
          originalPosition,
        })
      })
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
      const requestId = generateRequestId()

      this.notes.splice(index, 1)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          websocketService.offSkillNoteDeleted(handleSkillNoteDeleted)
          this.notes.splice(originalIndex, 0, note)
          reject(new Error('Delete skill note timeout'))
        }, 10000)

        const handleSkillNoteDeleted = (payload: SkillNoteDeletedPayload) => {
          if (payload.requestId !== requestId) return

          clearTimeout(timeoutId)
          websocketService.offSkillNoteDeleted(handleSkillNoteDeleted)

          if (payload.success) {
            resolve()
          } else {
            this.notes.splice(originalIndex, 0, note)
            reject(new Error(payload.error || 'Failed to delete skill note'))
          }
        }

        websocketService.onSkillNoteDeleted(handleSkillNoteDeleted)
        websocketService.skillNoteDelete({
          requestId,
          noteId,
        })
      })
    },
  },
})
