import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { useRunStore } from '@/stores/run/runStore'

vi.mock('@/components/run/RunCard.vue', () => ({
  default: {
    name: 'RunCard',
    props: ['run', 'isExpanded'],
    emits: ['toggle-expand', 'delete', 'open-pod-chat'],
    template: '<div data-testid="run-card"></div>',
  },
}))

import HistoryPanel from '@/components/run/HistoryPanel.vue'

async function mountOpenPanel() {
  const wrapper = mount(HistoryPanel, {
    props: { open: false },
    attachTo: document.body,
  })
  await wrapper.setProps({ open: true })
  await nextTick()
  return wrapper
}

describe('HistoryPanel', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('RunChatModal 開啟時，按 ESC 不應關閉 HistoryPanel', async () => {
    const wrapper = await mountOpenPanel()
    const runStore = useRunStore()
    runStore.activeRunChatModal = { runId: 'run-1', podId: 'pod-1' }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('update:open')).toBeFalsy()
    wrapper.unmount()
  })

  it('RunChatModal 開啟時，點擊 Modal 外部不應關閉 HistoryPanel', async () => {
    const wrapper = await mountOpenPanel()
    const runStore = useRunStore()
    runStore.activeRunChatModal = { runId: 'run-1', podId: 'pod-1' }

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(wrapper.emitted('update:open')).toBeFalsy()
    wrapper.unmount()
  })

  it('RunChatModal 未開啟時，按 ESC 應正常關閉 HistoryPanel', async () => {
    const wrapper = await mountOpenPanel()
    const runStore = useRunStore()
    runStore.activeRunChatModal = null

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    wrapper.unmount()
  })

  it('RunChatModal 未開啟時，點擊外部應正常關閉 HistoryPanel', async () => {
    const wrapper = await mountOpenPanel()
    const runStore = useRunStore()
    runStore.activeRunChatModal = null

    const outsideEl = document.createElement('div')
    document.body.appendChild(outsideEl)
    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    outsideEl.remove()

    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    wrapper.unmount()
  })
})
