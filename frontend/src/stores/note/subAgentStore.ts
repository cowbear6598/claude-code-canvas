import type { SubAgent, SubAgentNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { createResourceCRUDActions } from './createResourceCRUDActions'
import type {
  SubAgentCreatedPayload,
  SubAgentUpdatedPayload,
  SubAgentReadResultPayload,
  GroupCreatePayload,
  GroupCreatedPayload,
  GroupListPayload,
  GroupListResultPayload,
  GroupUpdatePayload,
  GroupUpdatedPayload,
  GroupDeletePayload,
  GroupDeletedPayload,
  MoveToGroupPayload,
  MovedToGroupPayload
} from '@/types/websocket'
import type { Group } from '@/types'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useCanvasStore } from '@/stores/canvasStore'
import { createWebSocketRequest } from '@/services/websocket'

interface SubAgentStoreCustomActions {
  createSubAgent(name: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  updateSubAgent(subAgentId: string, content: string): Promise<{ success: boolean; subAgent?: { id: string; name: string }; error?: string }>
  readSubAgent(subAgentId: string): Promise<{ id: string; name: string; content: string } | null>
  deleteSubAgent(subAgentId: string): Promise<void>
  loadSubAgents(): Promise<void>
  loadSubAgentGroups(): Promise<void>
  createSubAgentGroup(name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  updateSubAgentGroup(groupId: string, name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  deleteSubAgentGroup(groupId: string): Promise<{ success: boolean; error?: string }>
  moveSubAgentToGroup(subAgentId: string, groupId: string | null): Promise<{ success: boolean; error?: string }>
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
    listGroups: {
      request: WebSocketRequestEvents.GROUP_LIST,
      response: WebSocketResponseEvents.GROUP_LIST_RESULT,
    },
    createGroup: {
      request: WebSocketRequestEvents.GROUP_CREATE,
      response: WebSocketResponseEvents.GROUP_CREATED,
    },
    updateGroup: {
      request: WebSocketRequestEvents.GROUP_UPDATE,
      response: WebSocketResponseEvents.GROUP_UPDATED,
    },
    deleteGroup: {
      request: WebSocketRequestEvents.GROUP_DELETE,
      response: WebSocketResponseEvents.GROUP_DELETED,
    },
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

    async loadSubAgentGroups(this): Promise<void> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        console.warn('[SubAgentStore] Cannot load groups: no active canvas')
        return
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<GroupListPayload, GroupListResultPayload>({
          requestEvent: WebSocketRequestEvents.GROUP_LIST,
          responseEvent: WebSocketResponseEvents.GROUP_LIST_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            type: 'subagent'
          }
        }),
        '載入 SubAgent 群組失敗'
      )

      if (response?.groups) {
        this.groups = response.groups
      }
    },

    async createSubAgentGroup(this, name: string): Promise<{ success: boolean; group?: Group; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        return { success: false, error: 'No active canvas' }
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<GroupCreatePayload, GroupCreatedPayload>({
          requestEvent: WebSocketRequestEvents.GROUP_CREATE,
          responseEvent: WebSocketResponseEvents.GROUP_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            name,
            type: 'subagent'
          }
        }),
        '建立 SubAgent 群組失敗'
      )

      if (!response) {
        return { success: false, error: '建立群組失敗' }
      }

      if (response.group) {
        this.addGroupFromEvent(response.group)
      }

      return {
        success: response.success,
        group: response.group as Group,
        error: response.error
      }
    },

    async updateSubAgentGroup(this, groupId: string, name: string): Promise<{ success: boolean; group?: Group; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        return { success: false, error: 'No active canvas' }
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<GroupUpdatePayload, GroupUpdatedPayload>({
          requestEvent: WebSocketRequestEvents.GROUP_UPDATE,
          responseEvent: WebSocketResponseEvents.GROUP_UPDATED,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            groupId,
            name
          }
        }),
        '更新 SubAgent 群組失敗'
      )

      if (!response) {
        return { success: false, error: '更新群組失敗' }
      }

      if (response.group) {
        this.updateGroupFromEvent(response.group)
      }

      return {
        success: response.success,
        group: response.group as Group,
        error: response.error
      }
    },

    async deleteSubAgentGroup(this, groupId: string): Promise<{ success: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        return { success: false, error: 'No active canvas' }
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<GroupDeletePayload, GroupDeletedPayload>({
          requestEvent: WebSocketRequestEvents.GROUP_DELETE,
          responseEvent: WebSocketResponseEvents.GROUP_DELETED,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            groupId
          }
        }),
        '刪除 SubAgent 群組失敗'
      )

      if (!response) {
        return { success: false, error: '刪除群組失敗' }
      }

      if (response.success && response.groupId) {
        this.removeGroupFromEvent(response.groupId)
      }

      return {
        success: response.success,
        error: response.error
      }
    },

    async moveSubAgentToGroup(this, subAgentId: string, groupId: string | null): Promise<{ success: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        return { success: false, error: 'No active canvas' }
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<MoveToGroupPayload, MovedToGroupPayload>({
          requestEvent: WebSocketRequestEvents.SUBAGENT_MOVE_TO_GROUP,
          responseEvent: WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            itemId: subAgentId,
            groupId
          }
        }),
        '移動 SubAgent 失敗'
      )

      if (!response) {
        return { success: false, error: '移動失敗' }
      }

      if (response.success && response.itemId) {
        this.updateItemGroupId(response.itemId, response.groupId ?? null)
      }

      return {
        success: response.success,
        error: response.error
      }
    },
  }
})

export const useSubAgentStore: (() => ReturnType<typeof store> & SubAgentStoreCustomActions) & { $id: string } = store as any
