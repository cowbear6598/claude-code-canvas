import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, resetMockWebSocket, mockWebSocketClient } from '../../helpers/mockWebSocket'
import { useCursorTracker } from '@/composables/canvas/useCursorTracker'
import { useViewportStore } from '@/stores/pod/viewportStore'
import { WebSocketRequestEvents } from '@/types/websocket'

vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

function createContainerEl(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function mountWithTracker(containerEl: HTMLElement | null) {
  const containerRef = ref<HTMLElement | null>(containerEl)
  return mount({
    setup() {
      useCursorTracker(containerRef)
      return {}
    },
    template: '<div />',
  })
}

function fireMouseMove(el: HTMLElement, clientX: number, clientY: number): void {
  const event = new MouseEvent('mousemove', { clientX, clientY, bubbles: true })
  el.dispatchEvent(event)
}

describe('useCursorTracker', () => {
  let el: HTMLElement

  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.useFakeTimers()
    el = createContainerEl()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (el.parentNode) {
      el.parentNode.removeChild(el)
    }
  })

  describe('游標發送', () => {
    it('mousemove 時應立即發送 cursor:move 事件（第一次）', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(0, 0)
      viewportStore.zoom = 1

      mountWithTracker(el)
      await nextTick()

      fireMouseMove(el, 100, 200)

      expect(mockWebSocketClient.emit).toHaveBeenCalledWith(
        WebSocketRequestEvents.CURSOR_MOVE,
        { x: 100, y: 200 }
      )
    })

    it('100ms 內多次 mousemove 應只發送一次尾端節流', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(0, 0)
      viewportStore.zoom = 1

      mountWithTracker(el)
      await nextTick()

      fireMouseMove(el, 100, 200)
      mockWebSocketClient.emit.mockClear()

      fireMouseMove(el, 110, 210)
      fireMouseMove(el, 120, 220)
      fireMouseMove(el, 130, 230)

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(mockWebSocketClient.emit).toHaveBeenCalledTimes(1)
    })

    it('發送的座標應為 Canvas 座標（已套用 offset 和 zoom）', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(50, 50)
      viewportStore.zoom = 2

      mountWithTracker(el)
      await nextTick()

      fireMouseMove(el, 150, 250)

      const callArgs = mockWebSocketClient.emit.mock.calls[0]![1] as { x: number; y: number }
      expect(callArgs.x).toBe((150 - 50) / 2)
      expect(callArgs.y).toBe((250 - 50) / 2)
    })

    it('WebSocket 未連線時不應發送', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(0, 0)
      viewportStore.zoom = 1

      mockWebSocketClient.isConnected.value = false

      mountWithTracker(el)
      await nextTick()

      fireMouseMove(el, 100, 200)

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })
  })

  describe('containerRef 為 null', () => {
    it('containerRef 為 null 時不應報錯', async () => {
      expect(() => {
        mountWithTracker(null)
      }).not.toThrow()
    })

    it('containerRef 為 null 時 mousemove 不應觸發發送', async () => {
      mountWithTracker(null)
      await nextTick()

      fireMouseMove(document.body, 100, 200)

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })
  })

  describe('清理', () => {
    it('銷毀時應清除節流定時器，不再發送', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(0, 0)
      viewportStore.zoom = 1

      const wrapper = mountWithTracker(el)
      await nextTick()

      fireMouseMove(el, 100, 200)
      mockWebSocketClient.emit.mockClear()

      fireMouseMove(el, 110, 210)

      wrapper.unmount()

      vi.advanceTimersByTime(200)

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('銷毀後 mousemove 不應再發送', async () => {
      const viewportStore = useViewportStore()
      viewportStore.setOffset(0, 0)
      viewportStore.zoom = 1

      const wrapper = mountWithTracker(el)
      await nextTick()

      wrapper.unmount()

      vi.advanceTimersByTime(200)
      mockWebSocketClient.emit.mockClear()

      fireMouseMove(el, 100, 200)

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })
  })
})
