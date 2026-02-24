import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PodActions from '@/components/pod/PodActions.vue'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: { name: 'Dialog', template: '<div><slot /></div>', props: ['open'] },
  DialogContent: { name: 'DialogContent', template: '<div><slot /></div>' },
  DialogHeader: { name: 'DialogHeader', template: '<div><slot /></div>' },
  DialogTitle: { name: 'DialogTitle', template: '<div><slot /></div>' },
  DialogDescription: { name: 'DialogDescription', template: '<div><slot /></div>' },
  DialogFooter: { name: 'DialogFooter', template: '<div><slot /></div>' },
}))

vi.mock('@/components/ui/button', () => ({
  Button: { name: 'Button', template: '<button><slot /></button>', props: ['variant', 'disabled'] },
}))

const defaultProps = {
  podId: 'pod-1',
  podName: '測試 Pod',
  isSourcePod: true,
  showScheduleButton: false,
  isAutoClearEnabled: false,
  isAutoClearAnimating: false,
  isLoadingDownstream: false,
  isClearing: false,
  isTyping: false,
  downstreamPods: [],
  showClearDialog: false,
  showDeleteDialog: false,
  hasSchedule: false,
  scheduleEnabled: false,
  scheduleTooltip: '',
}

function mountPodActions(propsOverrides: Partial<typeof defaultProps> = {}) {
  return mount(PodActions, {
    props: { ...defaultProps, ...propsOverrides },
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: true }),
      ],
    },
    attachTo: document.body,
  })
}

function findEraserButton(wrapper: ReturnType<typeof mountPodActions>) {
  return wrapper.find('.workflow-clear-button-in-group')
}

describe('PodActions 橡皮擦按鈕 isTyping 行為', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('[High] isTyping=false 時橡皮擦按鈕正常可用', () => {
    it('isTyping=false 時橡皮擦按鈕不應被 disabled', () => {
      const wrapper = mountPodActions({ isTyping: false })
      const eraser = findEraserButton(wrapper)

      expect(eraser.attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })

    it('isTyping=false 時按下橡皮擦應觸發長按計時並在 mouseup 時 emit clear-workflow', async () => {
      vi.useFakeTimers()
      const wrapper = mountPodActions({ isTyping: false })
      const eraser = findEraserButton(wrapper)

      await eraser.trigger('mousedown', { clientX: 0, clientY: 0 })
      await eraser.trigger('mouseup')

      expect(wrapper.emitted('clear-workflow')).toBeTruthy()

      vi.useRealTimers()
      wrapper.unmount()
    })
  })

  describe('[High] isTyping=true 時橡皮擦按鈕應被禁用', () => {
    it('isTyping=true 時橡皮擦按鈕應有 disabled attribute', () => {
      const wrapper = mountPodActions({ isTyping: true })
      const eraser = findEraserButton(wrapper)

      expect(eraser.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('isTyping=true 時按下橡皮擦不應 emit clear-workflow', async () => {
      const wrapper = mountPodActions({ isTyping: true })
      const eraser = findEraserButton(wrapper)

      await eraser.trigger('mousedown', { clientX: 0, clientY: 0 })
      await eraser.trigger('mouseup')

      expect(wrapper.emitted('clear-workflow')).toBeFalsy()
      wrapper.unmount()
    })

    it('isTyping=true 時長按橡皮擦不應 emit toggle-auto-clear', async () => {
      vi.useFakeTimers()
      const wrapper = mountPodActions({ isTyping: true })
      const eraser = findEraserButton(wrapper)

      await eraser.trigger('mousedown', { clientX: 0, clientY: 0 })
      vi.advanceTimersByTime(600)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('toggle-auto-clear')).toBeFalsy()

      vi.useRealTimers()
      wrapper.unmount()
    })
  })

  describe('[Medium] isTyping 與其他 disabled 條件並存', () => {
    it('isLoadingDownstream=true 時橡皮擦應被 disabled', () => {
      const wrapper = mountPodActions({ isLoadingDownstream: true })
      const eraser = findEraserButton(wrapper)

      expect(eraser.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('isClearing=true 時橡皮擦應被 disabled', () => {
      const wrapper = mountPodActions({ isClearing: true })
      const eraser = findEraserButton(wrapper)

      expect(eraser.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('isTyping 從 true 變回 false 後橡皮擦應恢復可用', async () => {
      const wrapper = mountPodActions({ isTyping: true })
      const eraser = findEraserButton(wrapper)

      expect(eraser.attributes('disabled')).toBeDefined()

      await wrapper.setProps({ isTyping: false })

      expect(eraser.attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })
  })
})
