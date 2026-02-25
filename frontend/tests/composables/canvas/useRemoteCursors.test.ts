import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, resetMockWebSocket, simulateEvent, simulateDisconnect } from '../../helpers/mockWebSocket'
import { useRemoteCursors } from '@/composables/canvas/useRemoteCursors'
import { useCursorStore } from '@/stores/cursorStore'
import { useChatStore } from '@/stores/chat/chatStore'
import { WebSocketResponseEvents } from '@/types/websocket'
import type { CursorMovedPayload, CursorLeftPayload } from '@/types/websocket'

vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

function mountWithComposable() {
  return mount({
    setup() {
      useRemoteCursors()
      return {}
    },
    template: '<div />',
  })
}

describe('useRemoteCursors', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
  })

  describe('事件處理', () => {
    it('收到 cursor:moved 事件應更新 cursorStore', async () => {
      mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      const payload: CursorMovedPayload = {
        connectionId: 'conn-other',
        x: 100,
        y: 200,
        color: '#ff0000',
      }

      simulateEvent(WebSocketResponseEvents.CURSOR_MOVED, payload)

      expect(cursorStore.cursors.get('conn-other')).toEqual({
        connectionId: 'conn-other',
        x: 100,
        y: 200,
        color: '#ff0000',
      })
    })

    it('收到 cursor:left 事件應從 cursorStore 移除游標', async () => {
      mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-other', x: 0, y: 0, color: '#000' })

      const payload: CursorLeftPayload = { connectionId: 'conn-other' }
      simulateEvent(WebSocketResponseEvents.CURSOR_LEFT, payload)

      expect(cursorStore.cursors.has('conn-other')).toBe(false)
    })

    it('應忽略自己的 connectionId（與 chatStore.socketId 相同）', async () => {
      const chatStore = useChatStore()
      chatStore.socketId = 'my-socket-id'

      mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      const payload: CursorMovedPayload = {
        connectionId: 'my-socket-id',
        x: 100,
        y: 200,
        color: '#ff0000',
      }

      simulateEvent(WebSocketResponseEvents.CURSOR_MOVED, payload)

      expect(cursorStore.cursors.has('my-socket-id')).toBe(false)
    })
  })

  describe('生命週期', () => {
    it('銷毀後 cursor:moved 事件不應再更新 cursorStore', async () => {
      const wrapper = mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      wrapper.unmount()

      const payload: CursorMovedPayload = {
        connectionId: 'conn-after-unmount',
        x: 100,
        y: 200,
        color: '#ff0000',
      }

      simulateEvent(WebSocketResponseEvents.CURSOR_MOVED, payload)

      expect(cursorStore.cursors.has('conn-after-unmount')).toBe(false)
    })
  })

  describe('斷線處理', () => {
    it('斷線時應清空所有游標', async () => {
      mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 0, y: 0, color: '#000' })
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-2', x: 10, y: 20, color: '#fff' })

      simulateDisconnect('server disconnect')

      expect(cursorStore.cursors.size).toBe(0)
    })

    it('銷毀時應清空所有游標', async () => {
      const wrapper = mountWithComposable()
      await nextTick()

      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 0, y: 0, color: '#000' })

      wrapper.unmount()

      expect(cursorStore.cursors.size).toBe(0)
    })
  })
})
