import type { SubAgent, SubAgentNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import type { NoteStoreContext } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { createResourceCRUDActions } from './createResourceCRUDActions'
import { createGroupCRUDActions } from './createGroupCRUDActions'
import type {
  SubAgentCreatedPayload,
  SubAgentUpdatedPayload,
  SubAgentReadResultPayload,
} from '@/types/websocket'
import type { Group } from '@/types'

interface SubAgentStoreCustomActions {
  createSubAgent(name: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  updateSubAgent(subAgentId: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  readSubAgent(subAgentId: string): Promise<{ id: string; name: string; content: string } | null>
  deleteSubAgent(subAgentId: string): Promise<void>
  loadSubAgents(): Promise<void>
  loadGroups(): Promise<void>
  createGroup(name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }>
  moveItemToGroup(subAgentId: string, groupId: string | null): Promise<{ success: boolean; error?: string }>
}

const subAgentGroupCRUD = createGroupCRUDActions({
  storeName: 'SubAgentStore',
  groupType: 'subagent',
  toastCategory: 'SubAgent',
  moveItemToGroupEvents: {
    request: WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
    response: WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
  },
})

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
  },
  'SubAgent'
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
  groupEvents: {
    moveItemToGroup: {
      request: WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
      response: WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
    },
  },
  createNotePayload: (item: SubAgent) => ({
    subAgentId: item.id,
  }),
  getItemId: (item: SubAgent) => item.id,
  getItemName: (item: SubAgent) => item.name,
  customActions: {
    async createSubAgent(this: NoteStoreContext<SubAgent>, name: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }> {
      const result = await subAgentCRUD.create(this.availableItems, name, content)
      return result.success ? { success: true, subAgent: result.item } : { success: false, error: result.error }
    },

    async updateSubAgent(this: NoteStoreContext<SubAgent>, subAgentId: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }> {
      const result = await subAgentCRUD.update(this.availableItems, subAgentId, content)
      return result.success ? { success: true, subAgent: result.item } : { success: false, error: result.error }
    },

    async readSubAgent(this: NoteStoreContext<SubAgent>, subAgentId: string): Promise<{ id: string; name: string; content: string } | null> {
      return subAgentCRUD.read(subAgentId)
    },

    async deleteSubAgent(this: NoteStoreContext<SubAgent>, subAgentId: string): Promise<void> {
      return this.deleteItem(subAgentId)
    },

    async loadSubAgents(this: NoteStoreContext<SubAgent>): Promise<void> {
      return this.loadItems()
    },

    loadGroups: subAgentGroupCRUD.loadGroups,
    createGroup: subAgentGroupCRUD.createGroup,
    deleteGroup: subAgentGroupCRUD.deleteGroup,
    moveItemToGroup: subAgentGroupCRUD.moveItemToGroup,
  }
})

export const useSubAgentStore: (() => ReturnType<typeof store> & SubAgentStoreCustomActions) & { $id: string } = store as (() => ReturnType<typeof store> & SubAgentStoreCustomActions) & { $id: string }
