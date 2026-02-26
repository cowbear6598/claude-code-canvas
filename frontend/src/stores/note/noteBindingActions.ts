import {createWebSocketRequest} from '@/services/websocket'
import {useCanvasStore} from '@/stores/canvasStore'
import type {NoteStoreConfig} from './createNoteStore'

interface BasePayload {
    requestId: string
    [key: string]: unknown
}

interface BaseResponse {
    requestId: string
    success: boolean
    [key: string]: unknown
}

interface Position {
    x: number
    y: number
}

interface NoteItem {
    id: string
    boundToPodId: string | null
    x: number
    y: number
    originalPosition?: Position | null
    [key: string]: unknown
}

interface NoteBindingStore {
    notes: NoteItem[]
    getNotesByPodId: (podId: string) => NoteItem[]
    unbindFromPod?: (podId: string, returnToOriginal?: boolean, targetPosition?: Position) => Promise<void>
}

export function createNoteBindingActions<TItem>(config: NoteStoreConfig<TItem>): {
    bindToPod: (this: NoteBindingStore, noteId: string, podId: string) => Promise<void>
    unbindFromPod: (this: NoteBindingStore, podId: string, returnToOriginal?: boolean, targetPosition?: Position) => Promise<void>
} {
    return {
        async bindToPod(this: NoteBindingStore, noteId: string, podId: string): Promise<void> {
            const note = this.notes.find(n => n.id === noteId)
            if (!note) return

            if (config.relationship === 'one-to-one') {
                const existingNotes = this.getNotesByPodId(podId)
                if (existingNotes.length > 0 && config.unbindEvents) {
                    await this.unbindFromPod!(podId, true)
                }
            }

            const originalPosition = {x: note.x, y: note.y}

            if (!config.bindEvents) return

            const canvasStore = useCanvasStore()

            await Promise.all([
                createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.bindEvents.request,
                    responseEvent: config.bindEvents.response,
                    payload: {
                        canvasId: canvasStore.activeCanvasId!,
                        podId,
                        [config.itemIdField]: (note as Record<string, unknown>)[config.itemIdField]
                    }
                }),
                createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.events.updateNote.request,
                    responseEvent: config.events.updateNote.response,
                    payload: {
                        canvasId: canvasStore.activeCanvasId!,
                        noteId,
                        boundToPodId: podId,
                        originalPosition,
                    }
                })
            ])
        },

        async unbindFromPod(this: NoteBindingStore, podId: string, returnToOriginal: boolean = false, targetPosition?: Position): Promise<void> {
            if (!config.unbindEvents || config.relationship !== 'one-to-one') return

            const notes = this.getNotesByPodId(podId)
            const note = notes[0]
            if (!note) return

            const noteId = note.id

            const canvasStore = useCanvasStore()

            const updatePayload: Record<string, unknown> = {
                canvasId: canvasStore.activeCanvasId!,
                noteId,
                boundToPodId: null,
                originalPosition: null,
            }

            if (returnToOriginal && note.originalPosition) {
                updatePayload.x = note.originalPosition.x
                updatePayload.y = note.originalPosition.y
            } else if (targetPosition) {
                updatePayload.x = targetPosition.x
                updatePayload.y = targetPosition.y
            }

            await Promise.all([
                createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.unbindEvents.request,
                    responseEvent: config.unbindEvents.response,
                    payload: {
                        canvasId: canvasStore.activeCanvasId!,
                        podId
                    }
                }),
                createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.events.updateNote.request,
                    responseEvent: config.events.updateNote.response,
                    payload: updatePayload
                })
            ])
        }
    }
}
