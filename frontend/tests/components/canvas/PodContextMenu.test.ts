import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import PodContextMenu from '@/components/canvas/PodContextMenu.vue'

const { mockWrapWebSocketRequest, mockToast, mockGetActiveCanvasIdOrWarn, mockGetPodById } = vi.hoisted(() => ({
  mockWrapWebSocketRequest: vi.fn(),
  mockToast: vi.fn(),
  mockGetActiveCanvasIdOrWarn: vi.fn(),
  mockGetPodById: vi.fn().mockReturnValue(null),
}))

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

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores')>()
  return {
    ...actual,
    usePodStore: () => ({
      getPodById: mockGetPodById,
    }),
  }
})

vi.mock('lucide-vue-next', () => ({
  FolderOpen: { name: 'FolderOpen', template: '<svg />' },
  MessageSquare: { name: 'MessageSquare', template: '<svg />' },
  Unplug: { name: 'Unplug', template: '<svg />' },
}))

vi.mock('@/components/icons/SlackIcon.vue', () => ({
  default: { name: 'SlackIcon', template: '<svg />' },
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

  describe('Slack 按鈕', () => {
    it('Pod 沒有 slackBinding 時應顯示「連接 Slack」按鈕', () => {
      mockGetPodById.mockReturnValue({ id: 'pod-123', slackBinding: undefined })

      const wrapper = mountMenu()
      const buttons = wrapper.findAll('button')
      const slackButton = buttons.find((b) => b.text().includes('連接 Slack'))

      expect(slackButton).toBeDefined()
      expect(slackButton?.exists()).toBe(true)
    })

    it('Pod 有 slackBinding 時應顯示「斷開 Slack」按鈕', () => {
      mockGetPodById.mockReturnValue({
        id: 'pod-123',
        slackBinding: { slackAppId: 'app-001', slackChannelId: 'C001' },
      })

      const wrapper = mountMenu()
      const buttons = wrapper.findAll('button')
      const slackButton = buttons.find((b) => b.text().includes('斷開 Slack'))

      expect(slackButton).toBeDefined()
      expect(slackButton?.exists()).toBe(true)
    })

    it('點擊「連接 Slack」應 emit connect-slack 事件', async () => {
      mockGetPodById.mockReturnValue({ id: 'pod-123', slackBinding: undefined })

      const wrapper = mountMenu()
      const buttons = wrapper.findAll('button')
      const slackButton = buttons.find((b) => b.text().includes('連接 Slack'))

      await slackButton?.trigger('click')

      expect(wrapper.emitted('connect-slack')).toBeTruthy()
      expect(wrapper.emitted('connect-slack')?.[0]).toEqual(['pod-123'])
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('點擊「斷開 Slack」應 emit disconnect-slack 事件', async () => {
      mockGetPodById.mockReturnValue({
        id: 'pod-123',
        slackBinding: { slackAppId: 'app-001', slackChannelId: 'C001' },
      })

      const wrapper = mountMenu()
      const buttons = wrapper.findAll('button')
      const slackButton = buttons.find((b) => b.text().includes('斷開 Slack'))

      await slackButton?.trigger('click')

      expect(wrapper.emitted('disconnect-slack')).toBeTruthy()
      expect(wrapper.emitted('disconnect-slack')?.[0]).toEqual(['pod-123'])
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})
