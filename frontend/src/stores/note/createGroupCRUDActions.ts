import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { createWebSocketRequest } from '@/services/websocket'
import { useCanvasStore } from '@/stores/canvasStore'
import { useToast } from '@/composables/useToast'
import type { ToastCategory } from '@/composables/useToast'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type {
  GroupListPayload,
  GroupListResultPayload,
  GroupCreatePayload,
  GroupCreatedPayload,
  GroupUpdatePayload,
  GroupUpdatedPayload,
  GroupDeletePayload,
  GroupDeletedPayload,
  MoveToGroupPayload,
  MovedToGroupPayload,
} from '@/types/websocket'
import type { Group } from '@/types'

export interface GroupCRUDConfig {
  storeName: string
  groupType: string
  toastCategory: ToastCategory
  moveItemToGroupEvents: {
    request: WebSocketRequestEvents
    response: WebSocketResponseEvents
  }
}

export interface GroupCRUDStoreContext {
  groups: Array<{ id: string; name: string; [key: string]: unknown }>
  addGroupFromEvent: (group: Record<string, unknown>) => void
  updateGroupFromEvent: (group: Record<string, unknown>) => void
  removeGroupFromEvent: (groupId: string) => void
  updateItemGroupId: (itemId: string, groupId: string | null) => void
}

export interface GroupCRUDActions {
  loadGroups(this: GroupCRUDStoreContext): Promise<void>
  createGroup(this: GroupCRUDStoreContext, name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  updateGroup(this: GroupCRUDStoreContext, groupId: string, name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  deleteGroup(this: GroupCRUDStoreContext, groupId: string): Promise<{ success: boolean; error?: string }>
  moveItemToGroup(this: GroupCRUDStoreContext, itemId: string, groupId: string | null): Promise<{ success: boolean; error?: string }>
}

export function createGroupCRUDActions(config: GroupCRUDConfig): GroupCRUDActions {
  const { wrapWebSocketRequest } = useWebSocketErrorHandler()
  const { showErrorToast } = useToast()

  return {
    async loadGroups(this: GroupCRUDStoreContext): Promise<void> {
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        console.warn(`[${config.storeName}] Cannot load groups: no active canvas`)
        return
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<GroupListPayload, GroupListResultPayload>({
          requestEvent: WebSocketRequestEvents.GROUP_LIST,
          responseEvent: WebSocketResponseEvents.GROUP_LIST_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            type: config.groupType as GroupListPayload['type']
          }
        })
      )

      if (!response) {
        showErrorToast(config.toastCategory, '載入群組失敗')
        return
      }

      if (response.groups) {
        this.groups = response.groups
      }
    },

    async createGroup(this: GroupCRUDStoreContext, name: string): Promise<{ success: boolean; group?: Group; error?: string }> {
      if (!name?.trim()) {
        return { success: false, error: '群組名稱不能為空' }
      }

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
            type: config.groupType as GroupCreatePayload['type']
          }
        })
      )

      if (!response) {
        showErrorToast(config.toastCategory, '建立群組失敗')
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

    async updateGroup(this: GroupCRUDStoreContext, groupId: string, name: string): Promise<{ success: boolean; group?: Group; error?: string }> {
      if (!groupId?.trim()) {
        return { success: false, error: '無效的群組 ID' }
      }

      if (!name?.trim()) {
        return { success: false, error: '群組名稱不能為空' }
      }

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
        })
      )

      if (!response) {
        showErrorToast(config.toastCategory, '更新群組失敗')
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

    async deleteGroup(this: GroupCRUDStoreContext, groupId: string): Promise<{ success: boolean; error?: string }> {
      if (!groupId?.trim()) {
        return { success: false, error: '無效的群組 ID' }
      }

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
        })
      )

      if (!response) {
        showErrorToast(config.toastCategory, '刪除群組失敗')
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

    async moveItemToGroup(this: GroupCRUDStoreContext, itemId: string, groupId: string | null): Promise<{ success: boolean; error?: string }> {
      if (!itemId?.trim()) {
        return { success: false, error: '無效的項目 ID' }
      }

      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        return { success: false, error: 'No active canvas' }
      }

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<MoveToGroupPayload, MovedToGroupPayload>({
          requestEvent: config.moveItemToGroupEvents.request,
          responseEvent: config.moveItemToGroupEvents.response,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            itemId,
            groupId
          }
        })
      )

      if (!response) {
        showErrorToast(config.toastCategory, '移動失敗')
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
}
