import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { useCanvasStore } from '@/stores/canvasStore'
import { requireActiveCanvas, getActiveCanvasIdOrWarn } from '@/utils/canvasGuard'

vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    websocketClient: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    createWebSocketRequest: vi.fn(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    showSuccessToast: vi.fn(),
    showErrorToast: vi.fn(),
  }),
}))

vi.mock('@/utils/errorSanitizer', () => ({
  sanitizeErrorForUser: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message
    return '未知錯誤'
  }),
}))

describe('canvasGuard', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  describe('requireActiveCanvas', () => {
    it('有 activeCanvasId 時回傳 id', () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-123'

      const result = requireActiveCanvas()

      expect(result).toBe('canvas-123')
    })

    it('無 activeCanvasId 時拋出錯誤', () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null

      expect(() => requireActiveCanvas()).toThrow('沒有啟用的畫布')
    })
  })

  describe('getActiveCanvasIdOrWarn', () => {
    it('有 activeCanvasId 時回傳 id', () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-456'

      const result = getActiveCanvasIdOrWarn('TestContext')

      expect(result).toBe('canvas-456')
    })

    it('無 activeCanvasId 時回傳 null 並 warn', () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = getActiveCanvasIdOrWarn('TestContext')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('[TestContext] 沒有啟用的畫布')
    })
  })
})
