import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { createMockPod } from '../../helpers/factories'
import ChatModal from '@/components/chat/ChatModal.vue'

// Mock 子元件，避免它們本身的依賴影響測試
vi.mock('@/components/chat/ChatHeader.vue', () => ({
  default: {
    name: 'ChatHeader',
    props: ['pod'],
    emits: ['close'],
    template: '<div data-testid="chat-header"><button @click="$emit(\'close\')">關閉</button></div>',
  },
}))

vi.mock('@/components/chat/ChatMessages.vue', () => ({
  default: {
    name: 'ChatMessages',
    props: ['messages', 'isTyping', 'isLoadingHistory'],
    template: '<div data-testid="chat-messages"></div>',
  },
}))

vi.mock('@/components/chat/ChatInput.vue', () => ({
  default: {
    name: 'ChatInput',
    props: ['isTyping'],
    emits: ['send', 'abort'],
    template: '<div data-testid="chat-input"></div>',
  },
}))

// Mock chatStore，避免 websocket 依賴
vi.mock('@/stores/chat', () => ({
  useChatStore: () => ({
    getMessages: vi.fn(() => []),
    isTyping: vi.fn(() => false),
    isHistoryLoading: vi.fn(() => false),
    sendMessage: vi.fn(),
    abortChat: vi.fn(),
  }),
}))

function mountChatModal() {
  const pod = createMockPod({ id: 'test-pod-1' })
  return mount(ChatModal, {
    props: { pod },
  })
}

describe('ChatModal ESC 鍵行為', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    // 清理可能殘留在 document.body 的測試 DOM 元素
    const openDialogs = document.querySelectorAll('[data-state="open"][role="dialog"]')
    openDialogs.forEach((el) => el.remove())
  })

  it('按 ESC 時無 Dialog 開啟，應觸發 close emit', async () => {
    const wrapper = mountChatModal()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('按 ESC 時有 reka-ui Dialog 開啟中，不應觸發 close emit', async () => {
    const wrapper = mountChatModal()

    // 模擬 reka-ui Dialog 開啟的 DOM 狀態
    const dialogEl = document.createElement('div')
    dialogEl.setAttribute('data-state', 'open')
    dialogEl.setAttribute('role', 'dialog')
    document.body.appendChild(dialogEl)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeFalsy()

    // 清理插入的 DOM 元素
    dialogEl.remove()
    wrapper.unmount()
  })

  it('按其他鍵（如 Enter），不應觸發 close emit', async () => {
    const wrapper = mountChatModal()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(wrapper.emitted('close')).toBeFalsy()

    wrapper.unmount()
  })

  it('元件 unmount 後按 ESC，listener 應已被移除，不應觸發任何事件', async () => {
    const wrapper = mountChatModal()

    // 先確認 mount 後 ESC 有效
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    // unmount 後 listener 應已被移除
    wrapper.unmount()

    // 使用 spy 確認 emit 不再被呼叫
    const emitSpy = vi.spyOn(wrapper.vm, '$emit' as never)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // unmount 後不應再有新的 close emit
    expect(emitSpy).not.toHaveBeenCalled()
  })
})
