import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { createWebSocketRequest } from '@/services/websocket'
import type { WebSocketRequestEvents, WebSocketResponseEvents } from '@/types/websocket'

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

export function createResourceCRUDActions<TItem extends { id: string; name: string }>(
  resourceType: string,
  events: CRUDEventsConfig,
  config: CRUDPayloadConfig<TItem>
) {
  const { wrapWebSocketRequest } = useWebSocketErrorHandler()

  return {
    async create(
      items: TItem[],
      name: string,
      content: string
    ): Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }> {
      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.create.request,
          responseEvent: events.create.response,
          payload: { name, content }
        }),
        `建立 ${resourceType} 失敗`
      )

      if (!response) {
        return { success: false, error: `建立 ${resourceType} 失敗` }
      }

      const item = config.extractItemFromResponse.create(response)
      if (!item) {
        return {
          success: false,
          error: (response as { error?: string }).error || `建立 ${resourceType} 失敗`
        }
      }

      items.push(item as TItem)
      return { success: true, item }
    },

    async update(
      items: TItem[],
      itemId: string,
      content: string
    ): Promise<{ success: boolean; item?: { id: string; name: string }; error?: string }> {
      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.update.request,
          responseEvent: events.update.response,
          payload: config.getUpdatePayload(itemId, content)
        }),
        `更新 ${resourceType} 失敗`
      )

      if (!response) {
        return { success: false, error: `更新 ${resourceType} 失敗` }
      }

      const item = config.extractItemFromResponse.update(response)
      if (!item) {
        return {
          success: false,
          error: (response as { error?: string }).error || `更新 ${resourceType} 失敗`
        }
      }

      config.updateItemsList(items, itemId, item)
      return { success: true, item }
    },

    async read(
      itemId: string
    ): Promise<{ id: string; name: string; content: string } | null> {
      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: events.read.request,
          responseEvent: events.read.response,
          payload: config.getReadPayload(itemId)
        }),
        `讀取 ${resourceType} 失敗`
      )

      if (!response) {
        return null
      }

      return config.extractItemFromResponse.read(response) || null
    }
  }
}
