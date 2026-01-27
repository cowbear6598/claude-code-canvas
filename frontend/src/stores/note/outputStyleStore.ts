import {defineStore} from 'pinia'
import type {OutputStyleListItem, OutputStyleNote, Pod} from '@/types'
import type {BaseNoteState} from './createNoteStore'
import {createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import type {
    OutputStyleListResultPayload,
    PodOutputStyleBoundPayload,
    PodOutputStyleUnboundPayload,
    NoteListResultPayload,
    NoteCreatedPayload,
    NoteUpdatedPayload,
    OutputStyleListPayload,
    NoteListPayload,
    NoteCreatePayload,
    NoteUpdatePayload,
    NoteDeletePayload,
    NoteDeletedPayload,
    PodBindOutputStylePayload,
    PodUnbindOutputStylePayload
} from '@/types/websocket'

interface OutputStyleState extends BaseNoteState<OutputStyleListItem, OutputStyleNote> {
    availableItems: OutputStyleListItem[]
    notes: OutputStyleNote[]
}

export const useOutputStyleStore = defineStore('outputStyle', {
    state: (): OutputStyleState => ({
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
        availableStyles: (state): OutputStyleListItem[] => state.availableItems,

        getUnboundNotes: (state): OutputStyleNote[] =>
            state.notes.filter(note => note.boundToPodId === null),

        getNoteByPodId: (state) => (podId: string): OutputStyleNote | undefined =>
            state.notes.find(note => note.boundToPodId === podId),

        getNoteById: (state) => (noteId: string): OutputStyleNote | undefined =>
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
                createWebSocketRequest<OutputStyleListPayload, OutputStyleListResultPayload>({
                    requestEvent: WebSocketRequestEvents.OUTPUT_STYLE_LIST,
                    responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
                    payload: {}
                }),
                '載入 Output Style 失敗'
            )

            this.isLoading = false

            if (!response) {
                this.error = '載入失敗'
                return
            }

            if (response.styles) {
                this.availableItems = response.styles
            }
        },

        async loadNotesFromBackend(): Promise<void> {
            this.isLoading = true
            this.error = null

            const { wrapWebSocketRequest } = useWebSocketErrorHandler()

            const response = await wrapWebSocketRequest(
                createWebSocketRequest<NoteListPayload, NoteListResultPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_LIST,
                    responseEvent: WebSocketResponseEvents.NOTE_LIST_RESULT,
                    payload: {}
                }),
                '載入 Output Style 筆記失敗'
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

        async createNote(outputStyleId: string, x: number, y: number): Promise<void> {
            const style = this.availableItems.find(s => s.id === outputStyleId)
            if (!style) return

            const response = await createWebSocketRequest<NoteCreatePayload, NoteCreatedPayload>({
                requestEvent: WebSocketRequestEvents.NOTE_CREATE,
                responseEvent: WebSocketResponseEvents.NOTE_CREATED,
                payload: {
                    outputStyleId,
                    name: style.name,
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
                createWebSocketRequest<NoteUpdatePayload, NoteUpdatedPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_UPDATE,
                    responseEvent: WebSocketResponseEvents.NOTE_UPDATED,
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

            const existingNote = this.getNoteByPodId(podId)
            if (existingNote) {
                await this.unbindFromPod(podId, true)
            }

            const originalPosition = {x: note.x, y: note.y}

            const [, updateResponse] = await Promise.all([
                createWebSocketRequest<PodBindOutputStylePayload, PodOutputStyleBoundPayload>({
                    requestEvent: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
                    responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
                    payload: {
                        podId,
                        outputStyleId: note.outputStyleId
                    }
                }),
                createWebSocketRequest<NoteUpdatePayload, NoteUpdatedPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_UPDATE,
                    responseEvent: WebSocketResponseEvents.NOTE_UPDATED,
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
                createWebSocketRequest<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>({
                    requestEvent: WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
                    responseEvent: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
                    payload: {
                        podId
                    }
                }),
                createWebSocketRequest<NoteUpdatePayload, NoteUpdatedPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_UPDATE,
                    responseEvent: WebSocketResponseEvents.NOTE_UPDATED,
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
                createWebSocketRequest<NoteDeletePayload, NoteDeletedPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_DELETE,
                    responseEvent: WebSocketResponseEvents.NOTE_DELETED,
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

        async rebuildNotesFromPods(pods: Pod[]): Promise<void> {
            const promises: Promise<void>[] = []

            for (const pod of pods) {
                if (!pod.outputStyleId) continue

                const existingNote = this.getNoteByPodId(pod.id)
                if (existingNote) continue

                const style = this.availableItems.find(s => s.id === pod.outputStyleId)
                const styleName = style?.name || pod.outputStyleId

                const promise = createWebSocketRequest<NoteCreatePayload, NoteCreatedPayload>({
                    requestEvent: WebSocketRequestEvents.NOTE_CREATE,
                    responseEvent: WebSocketResponseEvents.NOTE_CREATED,
                    payload: {
                        outputStyleId: pod.outputStyleId,
                        name: styleName,
                        x: pod.x,
                        y: pod.y - 50,
                        boundToPodId: pod.id,
                        originalPosition: {x: pod.x, y: pod.y - 50},
                    }
                }).then(response => {
                    if (response.note) {
                        this.notes.push(response.note)
                    }
                })

                promises.push(promise)
            }

            if (promises.length > 0) {
                await Promise.all(promises)
            }
        },

        // Backward compatibility alias
        async loadOutputStyles(): Promise<void> {
            return this.loadItems()
        },
    },
})
