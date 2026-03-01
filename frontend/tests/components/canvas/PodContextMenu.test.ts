import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import PodContextMenu from '@/components/canvas/PodContextMenu.vue'

const mockWrapWebSocketRequest = vi.fn()
const mockToast = vi.fn()
const mockGetActiveCanvasIdOrWarn = vi.fn()

vi.mock('@/composables/useWebSocketErrorHandler', () => ({
  useWebSocketErrorHandler: () => ({
    wrapWebSocketRequest: mockWrapWebSocketRequest,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/services/websocket', () => ({
  createWebSocketRequest: vi.fn(() => Promise.resolve({ requestId: 'req-1', success: true })),
  WebSocketRequestEvents: {
    POD_OPEN_DIRECTORY: 'pod:open-directory',
  },
  WebSocketResponseEvents: {
    POD_DIRECTORY_OPENED: 'pod:directory:opened',
  },
}))

vi.mock('@/utils/canvasGuard', () => ({
  getActiveCanvasIdOrWarn: (...args: unknown[]) => mockGetActiveCanvasIdOrWarn(...args),
}))

vi.mock('lucide-vue-next', () => ({
  FolderOpen: { name: 'FolderOpen', template: '<svg />' },
}))

const defaultProps = {
  position: { x: 100, y: 200 },
  podId: 'pod-123',
}

function mountMenu(props = {}) {
  return mount(PodContextMenu, {
    props: { ...defaultProps, ...props },
    attachTo: document.body,
  })
}

describe('PodContextMenu', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockGetActiveCanvasIdOrWarn.mockReturnValue('canvas-1')
  })

  describe('元件渲染', () => {
    it('應在指定位置正確渲染選單', () => {
      const wrapper = mountMenu()

      const menuContainer = wrapper.find('.fixed.z-50')
      expect(menuContainer.exists()).toBe(true)

      const style = menuContainer.attributes('style')
      expect(style).toContain('left: 100px')
      expect(style).toContain('top: 200px')
    })

    it('應顯示「打開工作目錄」按鈕', () => {
      const wrapper = mountMenu()

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('打開工作目錄')
    })

    it('應渲染背景遮罩', () => {
      const wrapper = mountMenu()

      const overlay = wrapper.find('.fixed.inset-0.z-40')
      expect(overlay.exists()).toBe(true)
    })
  })

  describe('點擊背景遮罩關閉選單', () => {
    it('點擊背景遮罩應 emit close', async () => {
      const wrapper = mountMenu()

      const overlay = wrapper.find('.fixed.inset-0.z-40')
      await overlay.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('點擊「打開工作目錄」', () => {
    it('成功時應 emit close', async () => {
      mockWrapWebSocketRequest.mockResolvedValue({ requestId: 'req-1', success: true })

      const wrapper = mountMenu()
      const button = wrapper.find('button')
      await button.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('失敗時應顯示錯誤 toast', async () => {
      mockWrapWebSocketRequest.mockResolvedValue(null)

      const wrapper = mountMenu()
      const button = wrapper.find('button')
      await button.trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '打開目錄失敗',
          description: '無法打開工作目錄，請稍後再試',
          variant: 'destructive',
        })
      )
    })

    it('失敗時不應 emit close', async () => {
      mockWrapWebSocketRequest.mockResolvedValue(null)

      const wrapper = mountMenu()
      const button = wrapper.find('button')
      await button.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('沒有啟用的畫布時不應發送 WebSocket 請求', async () => {
      mockGetActiveCanvasIdOrWarn.mockReturnValue(null)

      const wrapper = mountMenu()
      const button = wrapper.find('button')
      await button.trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockWrapWebSocketRequest).not.toHaveBeenCalled()
    })
  })
})
