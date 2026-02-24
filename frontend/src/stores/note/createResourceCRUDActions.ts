import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { createWebSocketRequest } from '@/services/websocket'
import { useCanvasStore } from '@/stores/canvasStore'
import { useToast } from '@/composables/useToast'
import type { WebSocketRequestEvents, WebSocketResponseEvents } from '@/types/websocket'
import type { ToastCategory } from '@/composables/useToast'

interface CRUDEventsConfig {
  create: {
    request: WebSocketRequestEvents
    response: WebSocketResponseEvents
  }
  update: {
    request: WebSocketRequestEvents
    response: WebSocketResponseEvents
  }
  read: {
    request: WebSocketRequestEvents
    response: WebSocketResponseEvents
  }
}

interface CRUDPayloadConfig<TItem> {
  getUpdatePayload: (itemId: string, content: string) => Record<string, unknown>
  getReadPayload: (itemId: string) => Record<string, unknown>
  extractItemFromResponse: {
    create: (response: unknown) => { id: string; name: string } | undefined
    update: (response: unknown) => { id: string; name: string } | undefined
    read: (response: unknown) => { id: string; name: string; content: string } | undefined
  }
  updateItemsList: (items: TItem[], itemId: string, newItem: { id: string; name: string }) => void
}

interface ResourceCRUDActions {
  create: (
    items: unknown[],
    name: string,
    content: string
  ) => Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }>
  update: (
    items: unknown[],
    itemId: string,
    content: string
  ) => Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }>
  read: (itemId: string) => Promise<{ id: string; name: string; content: string } | null>
}

export function createResourceCRUDActions<TItem extends { id: string; name: string }>(
  resourceType: string,
  events: CRUDEventsConfig,
  config: CRUDPayloadConfig<TItem>,
  toastCategory?: ToastCategory
): ResourceCRUDActions {
  const { wrapWebSocketRequest } = useWebSocketErrorHandler()
  const { showSuccessToast, showErrorToast } = useToast()

  return {
    async create(
      items: TItem[],
      name: string,
      content: string
    ): Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }> {
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.create.request,
          responseEvent: events.create.response,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            name,
            content
          }
        })
      )

      if (!response) {
        if (toastCategory) {
          showErrorToast(toastCategory, '建立失敗', `建立 ${resourceType} 失敗`)
        }
        return { success: false, error: `建立 ${resourceType} 失敗` }
      }

      const item = config.extractItemFromResponse.create(response)
      if (!item) {
        const error = (response as { error?: string }).error || `建立 ${resourceType} 失敗`
        if (toastCategory) {
          showErrorToast(toastCategory, '建立失敗', error)
        }
        return {
          success: false,
          error
        }
      }

      items.push(item as TItem)
      if (toastCategory) {
        showSuccessToast(toastCategory, '建立成功', name)
      }
      return { success: true, item }
    },

    async update(
      items: TItem[],
      itemId: string,
      content: string
    ): Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }> {
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.update.request,
          responseEvent: events.update.response,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            ...config.getUpdatePayload(itemId, content)
          }
        })
      )

      if (!response) {
        if (toastCategory) {
          showErrorToast(toastCategory, '更新失敗', `更新 ${resourceType} 失敗`)
        }
        return { success: false, error: `更新 ${resourceType} 失敗` }
      }

      const item = config.extractItemFromResponse.update(response)
      if (!item) {
        const error = (response as { error?: string }).error || `更新 ${resourceType} 失敗`
        if (toastCategory) {
          showErrorToast(toastCategory, '更新失敗', error)
        }
        return {
          success: false,
          error
        }
      }

      config.updateItemsList(items, itemId, item)
      if (toastCategory) {
        showSuccessToast(toastCategory, '更新成功', item.name)
      }
      return { success: true, item }
    },

    async read(
      itemId: string
    ): Promise<{ id: string; name: string; content: string } | null> {
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.read.request,
          responseEvent: events.read.response,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            ...config.getReadPayload(itemId)
          }
        })
      )

      if (!response) {
        return null
      }

      return config.extractItemFromResponse.read(response) || null
    }
  }
}
