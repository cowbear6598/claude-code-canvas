import type { SubAgent, SubAgentNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'

interface SubAgentStoreCustomActions {
  deleteSubAgent(subAgentId: string): Promise<void>
  loadSubAgents(): Promise<void>
}

const store = createNoteStore<SubAgent, SubAgentNote>({
  storeName: 'subAgent',
  relationship: 'one-to-many',
  responseItemsKey: 'subAgents',
  itemIdField: 'subAgentId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.SUBAGENT_LIST,
      response: WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.SUBAGENT_NOTE_LIST,
      response: WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.SUBAGENT_NOTE_CREATE,
      response: WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.SUBAGENT_NOTE_UPDATE,
      response: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.SUBAGENT_NOTE_DELETE,
      response: WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_SUBAGENT,
    response: WebSocketResponseEvents.POD_SUBAGENT_BOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.SUBAGENT_DELETE,
    response: WebSocketResponseEvents.SUBAGENT_DELETED,
  },
  createNotePayload: (item: SubAgent) => ({
    subAgentId: item.id,
  }),
  getItemId: (item: SubAgent) => item.id,
  getItemName: (item: SubAgent) => item.name,
  customActions: {
    async deleteSubAgent(this, subAgentId: string): Promise<void> {
      return this.deleteItem(subAgentId)
    },

    async loadSubAgents(this): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useSubAgentStore: (() => ReturnType<typeof store> & SubAgentStoreCustomActions) & { $id: string } = store as any
