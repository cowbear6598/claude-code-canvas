import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PullLatestConfirmModal from '@/components/canvas/PullLatestConfirmModal.vue'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: {
    name: 'Dialog',
    props: ['open'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="dialog"><slot /></div>',
  },
  DialogContent: {
    name: 'DialogContent',
    template: '<div data-testid="dialog-content"><slot /></div>',
  },
  DialogHeader: {
    name: 'DialogHeader',
    template: '<div data-testid="dialog-header"><slot /></div>',
  },
  DialogTitle: {
    name: 'DialogTitle',
    template: '<div data-testid="dialog-title"><slot /></div>',
  },
  DialogDescription: {
    name: 'DialogDescription',
    template: '<div data-testid="dialog-description"><slot /></div>',
  },
  DialogFooter: {
    name: 'DialogFooter',
    template: '<div data-testid="dialog-footer"><slot /></div>',
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: {
    name: 'Button',
    props: ['variant', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}))

vi.mock('lucide-vue-next', () => ({
  AlertTriangle: {
    name: 'AlertTriangle',
    template: '<svg data-testid="alert-triangle" />',
  },
}))

function mountModal(props: { open?: boolean } = {}) {
  return mount(PullLatestConfirmModal, {
    props: {
      open: true,
      ...props,
    },
  })
}

describe('PullLatestConfirmModal', () => {
  it('顯示正確的警告訊息', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('此操作將丟棄所有本地修改')
  })

  it('Modal 應顯示標題「Pull 至最新版本」', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Pull 至最新版本')
  })

  it('Modal 應顯示技術說明文字（包含 git fetch + git reset --hard 相關）', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('git fetch')
    expect(wrapper.text()).toContain('git reset --hard')
  })

  it('open 為 false 時 Modal 不應渲染內容', () => {
    const wrapper = mountModal({ open: false })

    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false)
  })

  it('點擊確認按鈕 emit confirm 事件', async () => {
    const wrapper = mountModal()

    const buttons = wrapper.findAll('button')
    const confirmButton = buttons.find((btn) => btn.text().includes('確認 Pull'))
    expect(confirmButton).toBeDefined()

    await confirmButton!.trigger('click')

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('點擊取消按鈕 emit update:open 為 false', async () => {
    const wrapper = mountModal()

    const buttons = wrapper.findAll('button')
    const cancelButton = buttons.find((btn) => btn.text().includes('取消'))
    expect(cancelButton).toBeDefined()

    await cancelButton!.trigger('click')

    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')![0]).toEqual([false])
  })

  it('確認按鈕顯示「確認 Pull」且預設可點擊', () => {
    const wrapper = mountModal()

    const buttons = wrapper.findAll('button')
    const confirmButton = buttons.find((btn) => btn.text().includes('確認 Pull'))
    expect(confirmButton).toBeDefined()
    expect(confirmButton!.element.disabled).toBe(false)
  })

  it('取消按鈕預設可點擊', () => {
    const wrapper = mountModal()

    const buttons = wrapper.findAll('button')
    const cancelButton = buttons.find((btn) => btn.text().includes('取消'))
    expect(cancelButton).toBeDefined()
    expect(cancelButton!.element.disabled).toBe(false)
  })
})
