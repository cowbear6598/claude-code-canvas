import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PodSingleBindSlot from '@/components/pod/PodSingleBindSlot.vue'

vi.mock('@/composables/pod/useSlotDropTarget', () => ({
  useSlotDropTarget: () => ({
    isDropTarget: { value: false },
    isInserting: { value: false },
  }),
}))

vi.mock('@/composables/pod/useSlotEject', () => ({
  useSlotEject: () => ({
    isEjecting: { value: false },
    handleSlotClick: vi.fn(),
  }),
}))

function createMockStore(overrides = {}) {
  return {
    draggedNoteId: null,
    getNoteById: vi.fn(),
    setNoteAnimating: vi.fn(),
    unbindFromPod: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const defaultProps = {
  podId: 'pod-1',
  boundNote: undefined,
  store: createMockStore(),
  label: 'Skill',
  slotClass: 'skill-slot',
}

describe('PodSingleBindSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('未綁定 note 時', () => {
    it('應顯示 label 文字', () => {
      const wrapper = mount(PodSingleBindSlot, {
        props: defaultProps,
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })],
        },
      })

      expect(wrapper.text()).toContain('Skill')
      wrapper.unmount()
    })
  })

  describe('已綁定 note 時', () => {
    it('應顯示 note 名稱', () => {
      const boundNote = {
        id: 'note-1',
        name: 'My Skill',
        boundToPodId: 'pod-1',
        x: 0,
        y: 0,
        originalPosition: null,
      }

      const wrapper = mount(PodSingleBindSlot, {
        props: { ...defaultProps, boundNote },
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })],
        },
      })

      expect(wrapper.text()).toContain('My Skill')
      wrapper.unmount()
    })
  })
})
