import type { SubAgent, SubAgentNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { createResourceCRUDActions } from './createResourceCRUDActions'
import type {
  SubAgentCreatedPayload,
  SubAgentUpdatedPayload,
  SubAgentReadResultPayload
} from '@/types/websocket'

interface SubAgentStoreCustomActions {
  createSubAgent(name: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  updateSubAgent(subAgentId: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  readSubAgent(subAgentId: string): Promise<{ id: string; name: string; content: string } | null>
  deleteSubAgent(subAgentId: string): Promise<void>
  loadSubAgents(): Promise<void>
}

const subAgentCRUD = createResourceCRUDActions<SubAgent>(
  'SubAgent',
  {
    create: {
      request: WebSocketRequestEvents.SUBAGENT_CREATE,
      response: WebSocketResponseEvents.SUBAGENT_CREATED
    },
    update: {
      request: WebSocketRequestEvents.SUBAGENT_UPDATE,
      response: WebSocketResponseEvents.SUBAGENT_UPDATED
    },
    read: {
      request: WebSocketRequestEvents.SUBAGENT_READ,
      response: WebSocketResponseEvents.SUBAGENT_READ_RESULT
    }
  },
  {
    getUpdatePayload: (subAgentId, content) => ({ subAgentId, content }),
    getReadPayload: (subAgentId) => ({ subAgentId }),
    extractItemFromResponse: {
      create: (response) => (response as SubAgentCreatedPayload).subAgent,
      update: (response) => (response as SubAgentUpdatedPayload).subAgent,
      read: (response) => (response as SubAgentReadResultPayload).subAgent
    },
    updateItemsList: (items, subAgentId, newItem) => {
      const index = items.findIndex(item => item.id === subAgentId)
      if (index !== -1) {
        items[index] = newItem as SubAgent
      }
    }
  }
)

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
    async createSubAgent(this, name: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }> {
      const result = await subAgentCRUD.create(this.availableItems, name, content)
      return result.success ? { success: true, subAgent: result.item } : { success: false, error: result.error }
    },

    async updateSubAgent(this, subAgentId: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }> {
      const result = await subAgentCRUD.update(this.availableItems, subAgentId, content)
      return result.success ? { success: true, subAgent: result.item } : { success: false, error: result.error }
    },

    async readSubAgent(this, subAgentId: string): Promise<{ id: string; name: string; content: string } | null> {
      return subAgentCRUD.read(subAgentId)
    },

    async deleteSubAgent(this, subAgentId: string): Promise<void> {
      return this.deleteItem(subAgentId)
    },

    async loadSubAgents(this): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useSubAgentStore: (() => ReturnType<typeof store> & SubAgentStoreCustomActions) & { $id: string } = store as any
