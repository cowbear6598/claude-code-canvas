import { defineStore } from 'pinia'
import type { OutputStyleListItem, OutputStyleNote, Pod } from '@/types'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type {
  OutputStyleListResultPayload,
  PodOutputStyleBoundPayload,
  PodOutputStyleUnboundPayload,
  NoteListResultPayload,
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NoteDeletedPayload
} from '@/types/websocket'

interface OutputStyleState {
  availableStyles: OutputStyleListItem[]
  notes: OutputStyleNote[]
  isLoading: boolean
  error: string | null
  draggedNoteId: string | null
  animatingNoteIds: Set<string>
}

export const useOutputStyleStore = defineStore('outputStyle', {
  state: (): OutputStyleState => ({
    availableStyles: [],
    notes: [],
    isLoading: false,
    error: null,
    draggedNoteId: null,
    animatingNoteIds: new Set<string>(),
  }),

  getters: {
    getUnboundNotes: (state): OutputStyleNote[] =>
      state.notes.filter(note => note.boundToPodId === null),

    getNoteByPodId: (state) => (podId: string): OutputStyleNote | undefined =>
      state.notes.find(note => note.boundToPodId === podId),

    getNoteById: (state) => (noteId: string): OutputStyleNote | undefined =>
      state.notes.find(note => note.id === noteId),

    isNoteAnimating: (state) => (noteId: string): boolean =>
      state.animatingNoteIds.has(noteId),
  },

  actions: {
    async loadOutputStyles(): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        this.isLoading = true
        this.error = null

        const handleOutputStyleListResult = (payload: OutputStyleListResultPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offOutputStyleListResult(handleOutputStyleListResult)

            if (payload.success && payload.styles) {
              this.availableStyles = payload.styles
              this.isLoading = false
              resolve()
            } else {
              this.error = payload.error || 'Failed to load output styles'
              this.isLoading = false
              reject(new Error(this.error))
            }
          }
        }

        websocketService.onOutputStyleListResult(handleOutputStyleListResult)
        websocketService.outputStyleList({ requestId })

        setTimeout(() => {
          websocketService.offOutputStyleListResult(handleOutputStyleListResult)
          this.isLoading = false
          reject(new Error('Output style list timeout'))
        }, 10000)
      })
    },

    async loadNotesFromBackend(): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        this.isLoading = true
        this.error = null

        const handleNoteListResult = (payload: NoteListResultPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offNoteListResult(handleNoteListResult)

            if (payload.success && payload.notes) {
              this.notes = payload.notes
              this.isLoading = false
              resolve()
            } else {
              this.error = payload.error || 'Failed to load notes'
              this.isLoading = false
              reject(new Error(this.error))
            }
          }
        }

        websocketService.onNoteListResult(handleNoteListResult)
        websocketService.noteList({ requestId })

        setTimeout(() => {
          websocketService.offNoteListResult(handleNoteListResult)
          this.isLoading = false
          reject(new Error('Load notes timeout'))
        }, 10000)
      })
    },

    async createNote(outputStyleId: string, x: number, y: number): Promise<void> {
      const style = this.availableStyles.find(s => s.id === outputStyleId)
      if (!style) return

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleNoteCreated = (payload: NoteCreatedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offNoteCreated(handleNoteCreated)

            if (payload.success && payload.note) {
              this.notes.push(payload.note)
              resolve()
            } else {
              reject(new Error(payload.error || 'Failed to create note'))
            }
          }
        }

        websocketService.onNoteCreated(handleNoteCreated)
        websocketService.noteCreate({
          requestId,
          outputStyleId,
          name: style.name,
          x,
          y,
          boundToPodId: null,
          originalPosition: null,
        })

        setTimeout(() => {
          websocketService.offNoteCreated(handleNoteCreated)
          reject(new Error('Create note timeout'))
        }, 10000)
      })
    },

    async updateNotePosition(noteId: string, x: number, y: number): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      // Optimistically update
      note.x = x
      note.y = y

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleNoteUpdated = (payload: NoteUpdatedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offNoteUpdated(handleNoteUpdated)

            if (payload.success && payload.note) {
              const index = this.notes.findIndex(n => n.id === noteId)
              if (index !== -1) {
                this.notes[index] = payload.note
              }
              resolve()
            } else {
              reject(new Error(payload.error || 'Failed to update note'))
            }
          }
        }

        websocketService.onNoteUpdated(handleNoteUpdated)
        websocketService.noteUpdate({
          requestId,
          noteId,
          x,
          y,
        })

        setTimeout(() => {
          websocketService.offNoteUpdated(handleNoteUpdated)
          reject(new Error('Update note timeout'))
        }, 10000)
      })
    },

    async bindToPod(noteId: string, podId: string): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      const existingNote = this.getNoteByPodId(podId)
      if (existingNote) {
        await this.unbindFromPod(podId, true)
      }

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const originalPosition = { x: note.x, y: note.y }

        const handleBothResponses = () => {
          let podBound = false
          let noteUpdated = false

          const checkComplete = () => {
            if (podBound && noteUpdated) {
              resolve()
            }
          }

          const handlePodOutputStyleBound = (payload: PodOutputStyleBoundPayload) => {
            if (payload.requestId === requestId) {
              websocketService.offPodOutputStyleBound(handlePodOutputStyleBound)

              if (payload.success) {
                podBound = true
                checkComplete()
              } else {
                websocketService.offNoteUpdated(handleNoteUpdated)
                reject(new Error(payload.error || 'Failed to bind output style'))
              }
            }
          }

          const handleNoteUpdated = (payload: NoteUpdatedPayload) => {
            if (payload.requestId === requestId) {
              websocketService.offNoteUpdated(handleNoteUpdated)

              if (payload.success && payload.note) {
                const index = this.notes.findIndex(n => n.id === noteId)
                if (index !== -1) {
                  this.notes[index] = payload.note
                }
                noteUpdated = true
                checkComplete()
              } else {
                websocketService.offPodOutputStyleBound(handlePodOutputStyleBound)
                reject(new Error(payload.error || 'Failed to update note'))
              }
            }
          }

          websocketService.onPodOutputStyleBound(handlePodOutputStyleBound)
          websocketService.onNoteUpdated(handleNoteUpdated)

          websocketService.podBindOutputStyle({
            requestId,
            podId,
            outputStyleId: note.outputStyleId
          })

          websocketService.noteUpdate({
            requestId,
            noteId,
            boundToPodId: podId,
            originalPosition,
          })

          setTimeout(() => {
            websocketService.offPodOutputStyleBound(handlePodOutputStyleBound)
            websocketService.offNoteUpdated(handleNoteUpdated)
            reject(new Error('Bind operation timeout'))
          }, 10000)
        }

        handleBothResponses()
      })
    },

    async unbindFromPod(podId: string, returnToOriginal: boolean = false): Promise<void> {
      const note = this.notes.find(n => n.boundToPodId === podId)
      if (!note) return

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const noteId = note.id

        const handleBothResponses = () => {
          let podUnbound = false
          let noteUpdated = false

          const checkComplete = () => {
            if (podUnbound && noteUpdated) {
              resolve()
            }
          }

          const handlePodOutputStyleUnbound = (payload: PodOutputStyleUnboundPayload) => {
            if (payload.requestId === requestId) {
              websocketService.offPodOutputStyleUnbound(handlePodOutputStyleUnbound)

              if (payload.success) {
                podUnbound = true
                checkComplete()
              } else {
                websocketService.offNoteUpdated(handleNoteUpdated)
                reject(new Error(payload.error || 'Failed to unbind output style'))
              }
            }
          }

          const handleNoteUpdated = (payload: NoteUpdatedPayload) => {
            if (payload.requestId === requestId) {
              websocketService.offNoteUpdated(handleNoteUpdated)

              if (payload.success && payload.note) {
                const index = this.notes.findIndex(n => n.id === noteId)
                if (index !== -1) {
                  this.notes[index] = payload.note
                }
                noteUpdated = true
                checkComplete()
              } else {
                websocketService.offPodOutputStyleUnbound(handlePodOutputStyleUnbound)
                reject(new Error(payload.error || 'Failed to update note'))
              }
            }
          }

          websocketService.onPodOutputStyleUnbound(handlePodOutputStyleUnbound)
          websocketService.onNoteUpdated(handleNoteUpdated)

          websocketService.podUnbindOutputStyle({
            requestId,
            podId
          })

          const updatePayload: {
            requestId: string
            noteId: string
            boundToPodId: null
            originalPosition: null
            x?: number
            y?: number
          } = {
            requestId,
            noteId,
            boundToPodId: null,
            originalPosition: null,
          }

          if (returnToOriginal && note.originalPosition) {
            updatePayload.x = note.originalPosition.x
            updatePayload.y = note.originalPosition.y
          }

          websocketService.noteUpdate(updatePayload)

          setTimeout(() => {
            websocketService.offPodOutputStyleUnbound(handlePodOutputStyleUnbound)
            websocketService.offNoteUpdated(handleNoteUpdated)
            reject(new Error('Unbind operation timeout'))
          }, 10000)
        }

        handleBothResponses()
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

    async deleteNote(noteId: string): Promise<void> {
      const note = this.notes.find(n => n.id === noteId)
      if (!note) return

      // Optimistically remove from UI
      const index = this.notes.findIndex(n => n.id === noteId)
      if (index !== -1) {
        this.notes.splice(index, 1)
      }

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleNoteDeleted = (payload: NoteDeletedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offNoteDeleted(handleNoteDeleted)

            if (payload.success) {
              resolve()
            } else {
              // Re-add the note on error
              this.notes.push(note)
              reject(new Error(payload.error || 'Failed to delete note'))
            }
          }
        }

        websocketService.onNoteDeleted(handleNoteDeleted)
        websocketService.noteDelete({
          requestId,
          noteId,
        })

        setTimeout(() => {
          websocketService.offNoteDeleted(handleNoteDeleted)
          reject(new Error('Delete note timeout'))
        }, 10000)
      })
    },

    async rebuildNotesFromPods(pods: Pod[]): Promise<void> {
      const promises: Promise<void>[] = []

      for (const pod of pods) {
        if (!pod.outputStyleId) continue

        const existingNote = this.getNoteByPodId(pod.id)
        if (existingNote) continue

        const style = this.availableStyles.find(s => s.id === pod.outputStyleId)
        const styleName = style?.name || pod.outputStyleId

        const promise = new Promise<void>((resolve, reject) => {
          const requestId = generateRequestId()

          const handleNoteCreated = (payload: NoteCreatedPayload) => {
            if (payload.requestId === requestId) {
              websocketService.offNoteCreated(handleNoteCreated)

              if (payload.success && payload.note) {
                this.notes.push(payload.note)
                console.log(`[OutputStyleStore] Rebuilt note for Pod ${pod.id} with style ${pod.outputStyleId}`)
                resolve()
              } else {
                reject(new Error(payload.error || 'Failed to rebuild note'))
              }
            }
          }

          websocketService.onNoteCreated(handleNoteCreated)
          websocketService.noteCreate({
            requestId,
            outputStyleId: pod.outputStyleId!,
            name: styleName,
            x: pod.x,
            y: pod.y - 50,
            boundToPodId: pod.id,
            originalPosition: { x: pod.x, y: pod.y - 50 },
          })

          setTimeout(() => {
            websocketService.offNoteCreated(handleNoteCreated)
            reject(new Error('Rebuild note timeout'))
          }, 10000)
        })

        promises.push(promise)
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }
    },
  },
})
