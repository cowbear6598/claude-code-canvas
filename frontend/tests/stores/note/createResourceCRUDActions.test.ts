import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, mockCreateWebSocketRequest, resetMockWebSocket } from '../../helpers/mockWebSocket'
import { createResourceCRUDActions } from '@/stores/note/createResourceCRUDActions'
import { useCanvasStore } from '@/stores/canvasStore'
import type { WebSocketRequestEvents, WebSocketResponseEvents } from '@/types/websocket'
import type { ToastCategory } from '@/composables/useToast'

// 定義測試用的 config 類型（因為源碼沒有 export）
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

// Mock WebSocket
vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

// Mock useToast
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()
const mockToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
    toast: mockToast,
  }),
}))

// Mock sanitizeErrorForUser
vi.mock('@/utils/errorSanitizer', () => ({
  sanitizeErrorForUser: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return '未知錯誤'
  }),
}))

interface TestItem {
  id: string
  name: string
  content?: string
}

describe('createResourceCRUDActions', () => {
  let eventsConfig: CRUDEventsConfig
  let payloadConfig: CRUDPayloadConfig<TestItem>

  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()

    // 設定 activeCanvasId
    const canvasStore = useCanvasStore()
    canvasStore.activeCanvasId = 'canvas-1'

    // 設定測試用的 events config
    eventsConfig = {
      create: {
        request: 'test:create' as any,
        response: 'test:created' as any,
      },
      update: {
        request: 'test:update' as any,
        response: 'test:updated' as any,
      },
      read: {
        request: 'test:read' as any,
        response: 'test:read-result' as any,
      },
    }

    // 設定測試用的 payload config
    payloadConfig = {
      getUpdatePayload: (itemId: string, content: string) => ({
        itemId,
        content,
      }),
      getReadPayload: (itemId: string) => ({
        itemId,
      }),
      extractItemFromResponse: {
        create: (response: unknown) => {
          const res = response as { item?: TestItem }
          return res.item
        },
        update: (response: unknown) => {
          const res = response as { item?: TestItem }
          return res.item
        },
        read: (response: unknown) => {
          const res = response as { item?: TestItem & { content: string } }
          return res.item
        },
      },
      updateItemsList: (items: TestItem[], itemId: string, newItem: { id: string; name: string }) => {
        const index = items.findIndex((item) => item.id === itemId)
        if (index !== -1) {
          items[index] = { ...items[index], ...newItem }
        }
      },
    }
  })

  describe('create', () => {
    it('成功時應新增 item 到陣列、顯示成功 Toast', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const newItem = { id: 'item-1', name: 'Test Item' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item: newItem,
      })

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'test:create',
        responseEvent: 'test:created',
        payload: {
          canvasId: 'canvas-1',
          name: 'Test Item',
          content: 'Test Content',
        },
      })
      expect(items).toHaveLength(1)
      expect(items[0]).toEqual(newItem)
      expect(mockShowSuccessToast).toHaveBeenCalledWith('TestCategory', '建立成功', 'Test Item')
      expect(result).toEqual({
        success: true,
        item: newItem,
      })
    })

    it('無 toastCategory 時不應顯示 Toast', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      const newItem = { id: 'item-1', name: 'Test Item' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item: newItem,
      })

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(items).toHaveLength(1)
      expect(mockShowSuccessToast).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('WebSocket 錯誤時應顯示錯誤 Toast、回傳 error', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const error = new Error('Network error')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(items).toHaveLength(0)
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '建立失敗', '建立 測試資源 失敗')
      expect(result).toEqual({
        success: false,
        error: '建立 測試資源 失敗',
      })
    })

    it('WebSocket 錯誤且無 toastCategory 時不應顯示 Toast', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      const error = new Error('Network error')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(items).toHaveLength(0)
      expect(mockShowErrorToast).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: false,
        error: '建立 測試資源 失敗',
      })
    })

    it('response 無 item 時應回傳 error、顯示錯誤 Toast', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      mockCreateWebSocketRequest.mockResolvedValueOnce({})

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(items).toHaveLength(0)
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '建立失敗', '建立 測試資源 失敗')
      expect(result).toEqual({
        success: false,
        error: '建立 測試資源 失敗',
      })
    })

    it('response 含 error 欄位時應使用該錯誤訊息', async () => {
      const items: TestItem[] = []
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        error: '名稱重複',
      })

      const result = await actions.create(items, 'Test Item', 'Test Content')

      expect(items).toHaveLength(0)
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '建立失敗', '名稱重複')
      expect(result).toEqual({
        success: false,
        error: '名稱重複',
      })
    })
  })

  describe('update', () => {
    it('成功時應更新 items 陣列中的 item、顯示成功 Toast', async () => {
      const items: TestItem[] = [
        { id: 'item-1', name: 'Old Name', content: 'Old Content' },
      ]
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const updatedItem = { id: 'item-1', name: 'New Name' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item: updatedItem,
      })

      const result = await actions.update(items, 'item-1', 'New Content')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'test:update',
        responseEvent: 'test:updated',
        payload: {
          canvasId: 'canvas-1',
          itemId: 'item-1',
          content: 'New Content',
        },
      })
      expect(items[0]?.name).toBe('New Name')
      expect(mockShowSuccessToast).toHaveBeenCalledWith('TestCategory', '更新成功', 'New Name')
      expect(result).toEqual({
        success: true,
        item: updatedItem,
      })
    })

    it('無 toastCategory 時不應顯示 Toast', async () => {
      const items: TestItem[] = [
        { id: 'item-1', name: 'Old Name', content: 'Old Content' },
      ]
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      const updatedItem = { id: 'item-1', name: 'New Name' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item: updatedItem,
      })

      const result = await actions.update(items, 'item-1', 'New Content')

      expect(items[0]?.name).toBe('New Name')
      expect(mockShowSuccessToast).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('WebSocket 錯誤時應顯示錯誤 Toast、回傳 error', async () => {
      const items: TestItem[] = [
        { id: 'item-1', name: 'Old Name', content: 'Old Content' },
      ]
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const error = new Error('Update failed')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      const result = await actions.update(items, 'item-1', 'New Content')

      expect(items[0]?.name).toBe('Old Name') // 保持不變
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '更新失敗', '更新 測試資源 失敗')
      expect(result).toEqual({
        success: false,
        error: '更新 測試資源 失敗',
      })
    })

    it('response 無 item 時應回傳 error', async () => {
      const items: TestItem[] = [
        { id: 'item-1', name: 'Old Name', content: 'Old Content' },
      ]
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      mockCreateWebSocketRequest.mockResolvedValueOnce({})

      const result = await actions.update(items, 'item-1', 'New Content')

      expect(items[0]?.name).toBe('Old Name') // 保持不變
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '更新失敗', '更新 測試資源 失敗')
      expect(result).toEqual({
        success: false,
        error: '更新 測試資源 失敗',
      })
    })

    it('response 含 error 欄位時應使用該錯誤訊息', async () => {
      const items: TestItem[] = [
        { id: 'item-1', name: 'Old Name', content: 'Old Content' },
      ]
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        error: '權限不足',
      })

      const result = await actions.update(items, 'item-1', 'New Content')

      expect(items[0]?.name).toBe('Old Name') // 保持不變
      expect(mockShowErrorToast).toHaveBeenCalledWith('TestCategory', '更新失敗', '權限不足')
      expect(result).toEqual({
        success: false,
        error: '權限不足',
      })
    })
  })

  describe('read', () => {
    it('成功時應回傳 item', async () => {
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      const item = { id: 'item-1', name: 'Test Item', content: 'Test Content' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item,
      })

      const result = await actions.read('item-1')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'test:read',
        responseEvent: 'test:read-result',
        payload: {
          canvasId: 'canvas-1',
          itemId: 'item-1',
        },
      })
      expect(result).toEqual(item)
    })

    it('WebSocket 錯誤時應回傳 null', async () => {
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      const error = new Error('Read failed')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      const result = await actions.read('item-1')

      expect(result).toBeNull()
    })

    it('response 無 item 時應回傳 null', async () => {
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig)

      mockCreateWebSocketRequest.mockResolvedValueOnce({})

      const result = await actions.read('item-1')

      expect(result).toBeNull()
    })

    it('read 操作不應顯示任何 Toast', async () => {
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const item = { id: 'item-1', name: 'Test Item', content: 'Test Content' }

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        item,
      })

      await actions.read('item-1')

      expect(mockShowSuccessToast).not.toHaveBeenCalled()
      expect(mockShowErrorToast).not.toHaveBeenCalled()
    })

    it('read 失敗時也不應顯示 Toast', async () => {
      const actions = createResourceCRUDActions('測試資源', eventsConfig, payloadConfig, 'TestCategory' as ToastCategory)

      const error = new Error('Read failed')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      await actions.read('item-1')

      expect(mockShowSuccessToast).not.toHaveBeenCalled()
      expect(mockShowErrorToast).not.toHaveBeenCalled()
    })
  })
})
