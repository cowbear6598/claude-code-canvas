import {createWebSocketRequest} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {useCanvasStore} from '@/stores/canvasStore'
import type {NoteStoreConfig} from './createNoteStore'

interface BasePayload {
    requestId: string
    [key: string]: unknown
}

interface BaseResponse {
    requestId: string
    success: boolean
    note?: unknown
    [key: string]: unknown
}

interface NoteItem {
    id: string
    x: number
    y: number
    [key: string]: unknown
}

interface NotePositionStore {
    notes: NoteItem[]
}

export function createNotePositionActions<TItem>(config: NoteStoreConfig<TItem>): {
    updateNotePositionLocal: (this: NotePositionStore, noteId: string, x: number, y: number) => void
    updateNotePosition: (this: NotePositionStore, noteId: string, x: number, y: number) => Promise<void>
} {
    return {
        updateNotePositionLocal(this: NotePositionStore, noteId: string, x: number, y: number): void {
            const note = this.notes.find(n => n.id === noteId)
            if (!note) return
            note.x = x
            note.y = y
        },

        async updateNotePosition(this: NotePositionStore, noteId: string, x: number, y: number): Promise<void> {
            const note = this.notes.find(n => n.id === noteId)
            if (!note) return

            const originalX = note.x
            const originalY = note.y

            note.x = x
            note.y = y

            const {wrapWebSocketRequest} = useWebSocketErrorHandler()
            const canvasStore = useCanvasStore()

            const response = await wrapWebSocketRequest(
                createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.events.updateNote.request,
                    responseEvent: config.events.updateNote.response,
                    payload: {
                        canvasId: canvasStore.activeCanvasId!,
                        noteId,
                        x,
                        y,
                    }
                })
            )

            if (!response) {
                note.x = originalX
                note.y = originalY
                return
            }

            if (response.note) {
                const index = this.notes.findIndex(n => n.id === noteId)
                if (index !== -1) {
                    this.notes[index] = response.note as NoteItem
                }
            }
        }
    }
}
