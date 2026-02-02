import type { OutputStyleListItem, OutputStyleNote, Pod } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest } from '@/services/websocket'
import { createResourceCRUDActions } from './createResourceCRUDActions'
import { useCanvasStore } from '@/stores/canvasStore'
import type {
  NoteCreatePayload,
  NoteCreatedPayload,
  OutputStyleCreatedPayload,
  OutputStyleUpdatedPayload,
  OutputStyleReadResultPayload
} from '@/types/websocket'

interface OutputStyleStoreCustomActions {
  rebuildNotesFromPods(pods: Pod[]): Promise<void>
  createOutputStyle(name: string, content: string): Promise<{ success: boolean; outputStyle?: { id: string; name: string }; error?: string }>
  updateOutputStyle(outputStyleId: string, content: string): Promise<{ success: boolean; outputStyle?: { id: string; name: string }; error?: string }>
  readOutputStyle(outputStyleId: string): Promise<{ id: string; name: string; content: string } | null>
  deleteOutputStyle(outputStyleId: string): Promise<void>
  loadOutputStyles(): Promise<void>
}

const outputStyleCRUD = createResourceCRUDActions<OutputStyleListItem>(
  'Output Style',
  {
    create: {
      request: WebSocketRequestEvents.OUTPUT_STYLE_CREATE,
      response: WebSocketResponseEvents.OUTPUT_STYLE_CREATED
    },
    update: {
      request: WebSocketRequestEvents.OUTPUT_STYLE_UPDATE,
      response: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED
    },
    read: {
      request: WebSocketRequestEvents.OUTPUT_STYLE_READ,
      response: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT
    }
  },
  {
    getUpdatePayload: (outputStyleId, content) => ({ outputStyleId, content }),
    getReadPayload: (outputStyleId) => ({ outputStyleId }),
    extractItemFromResponse: {
      create: (response) => (response as OutputStyleCreatedPayload).outputStyle,
      update: (response) => (response as OutputStyleUpdatedPayload).outputStyle,
      read: (response) => (response as OutputStyleReadResultPayload).outputStyle
    },
    updateItemsList: (items, outputStyleId, newItem) => {
      const index = items.findIndex(item => item.id === outputStyleId)
      if (index !== -1) {
        items[index] = newItem as OutputStyleListItem
      }
    }
  }
)

const store = createNoteStore<OutputStyleListItem, OutputStyleNote>({
  storeName: 'outputStyle',
  relationship: 'one-to-one',
  responseItemsKey: 'styles',
  itemIdField: 'outputStyleId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.OUTPUT_STYLE_LIST,
      response: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.NOTE_LIST,
      response: WebSocketResponseEvents.NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.NOTE_CREATE,
      response: WebSocketResponseEvents.NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.NOTE_UPDATE,
      response: WebSocketResponseEvents.NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.NOTE_DELETE,
      response: WebSocketResponseEvents.NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
    response: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
  },
  unbindEvents: {
    request: WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
    response: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.OUTPUT_STYLE_DELETE,
    response: WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
  },
  createNotePayload: (item: OutputStyleListItem) => ({
    outputStyleId: item.id,
  }),
  getItemId: (item: OutputStyleListItem) => item.id,
  getItemName: (item: OutputStyleListItem) => item.name,
  customActions: {
    async rebuildNotesFromPods(this, pods: Pod[]): Promise<void> {
      const canvasStore = useCanvasStore()
      if (!canvasStore.activeCanvasId) {
        console.warn('[OutputStyleStore] Cannot rebuild notes: no active canvas')
        return
      }

      const promises: Promise<void>[] = []

      for (const pod of pods) {
        if (!pod.outputStyleId) continue

        const existingNotes = this.getNotesByPodId(pod.id)
        if (existingNotes.length > 0) continue

        const style = this.availableItems.find((s: OutputStyleListItem) => s.id === pod.outputStyleId)
        const styleName = style?.name || pod.outputStyleId

        const promise = createWebSocketRequest<NoteCreatePayload, NoteCreatedPayload>({
          requestEvent: WebSocketRequestEvents.NOTE_CREATE,
          responseEvent: WebSocketResponseEvents.NOTE_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            outputStyleId: pod.outputStyleId,
            name: styleName,
            x: pod.x,
            y: pod.y - 50,
            boundToPodId: pod.id,
            originalPosition: { x: pod.x, y: pod.y - 50 },
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

    async createOutputStyle(this, name: string, content: string): Promise<{ success: boolean; outputStyle?: { id: string; name: string }; error?: string }> {
      const result = await outputStyleCRUD.create(this.availableItems, name, content)
      return result.success ? { success: true, outputStyle: result.item } : { success: false, error: result.error }
    },

    async updateOutputStyle(this, outputStyleId: string, content: string): Promise<{ success: boolean; outputStyle?: { id: string; name: string }; error?: string }> {
      const result = await outputStyleCRUD.update(this.availableItems, outputStyleId, content)
      return result.success ? { success: true, outputStyle: result.item } : { success: false, error: result.error }
    },

    async readOutputStyle(this, outputStyleId: string): Promise<{ id: string; name: string; content: string } | null> {
      return outputStyleCRUD.read(outputStyleId)
    },

    async deleteOutputStyle(this, outputStyleId: string): Promise<void> {
      return this.deleteItem(outputStyleId)
    },

    async loadOutputStyles(this): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useOutputStyleStore: (() => ReturnType<typeof store> & OutputStyleStoreCustomActions) & { $id: string } = store as any
