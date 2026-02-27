import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'

describe('useSlotDropTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function createMockSlotElement() {
    const slotElement = document.createElement('div')
    const mockRect: DOMRect = {
      left: 100,
      top: 100,
      right: 200,
      bottom: 200,
      width: 100,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }
    vi.spyOn(slotElement, 'getBoundingClientRect').mockReturnValue(mockRect)
    return slotElement
  }

  describe('事件監聽器初始化', () => {
    it('draggedNoteId 有值時應設定事件監聽器', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      // 應該設定 mousemove 和 mouseup 監聽器
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), { capture: true })
    })

    it('draggedNoteId 為 null 時不應設定事件監聽器', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const draggedNoteId = ref<string | null>(null)

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('draggedNoteId 變為 null 時應清理監聽器', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const draggedNoteId = ref<string | null>('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { result, draggedNoteId }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 改變 draggedNoteId 為 null
      draggedNoteId.value = null
      await wrapper.vm.$nextTick()

      // 應該移除 mousemove 和 mouseup 監聽器
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), { capture: true })
    })

    it('component unmount 時應清理監聽器', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { result }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)
      wrapper.unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), { capture: true })
    })
  })

  describe('isDropTarget 狀態', () => {
    it('滑鼠在 slot 範圍內時 isDropTarget 應為 true', async () => {
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 模擬滑鼠在範圍內 (150, 150) - 在 (100-200, 100-200) 範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(true)
    })

    it('滑鼠在 slot 範圍外時 isDropTarget 應為 false', async () => {
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 模擬滑鼠在範圍外 (50, 50)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 50,
        clientY: 50,
      })
      document.dispatchEvent(mouseMoveEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(false)
    })

    it('滑鼠在 slot 邊界上時 isDropTarget 應為 true（left）', async () => {
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 模擬滑鼠在左邊界 (100, 150)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(true)
    })

    it('滑鼠在 slot 邊界上時 isDropTarget 應為 true（right）', async () => {
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 模擬滑鼠在右邊界 (200, 150)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(true)
    })

    it('slotRef 為 null 時 isDropTarget 應為 false', async () => {
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotRef = ref<HTMLElement | null>(null)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(false)
    })
  })

  describe('onDrop 觸發', () => {
    it('mouseup 且 isDropTarget 為 true 時應觸發 onDrop', async () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      expect(onDropMock).toHaveBeenCalledWith('note-1')
    })

    it('mouseup 但 isDropTarget 為 false 時不應觸發 onDrop', () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      // 直接 mouseup，沒有先移動到範圍內
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      expect(onDropMock).not.toHaveBeenCalled()
    })

    it('validateDrop 回傳 false 時不應觸發 onDrop', async () => {
      const onDropMock = vi.fn()
      const validateDropMock = vi.fn(() => false)
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: validateDropMock,
            onDrop: onDropMock,
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      expect(validateDropMock).toHaveBeenCalledWith('note-1')
      expect(onDropMock).not.toHaveBeenCalled()
    })

    it('validateDrop 回傳 true 時應觸發 onDrop', () => {
      const onDropMock = vi.fn()
      const validateDropMock = vi.fn(() => true)
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: validateDropMock,
            onDrop: onDropMock,
          })
          return { result }
        },
        render: () => h('div'),
      })

      mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      expect(validateDropMock).toHaveBeenCalledWith('note-1')
      expect(onDropMock).toHaveBeenCalledWith('note-1')
    })
  })

  describe('isInserting 狀態', () => {
    it('drop 後 isInserting 應為 true', async () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isInserting } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { isInserting }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isInserting).toBe(true)
    })

    it('300ms 後 isInserting 應恢復為 false', async () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isInserting } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { isInserting }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isInserting).toBe(true)

      // 等待 300ms
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isInserting).toBe(false)
    })

    it('validateDrop 為 false 時 isInserting 應保持為 false', async () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isInserting } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => false,
            onDrop: onDropMock,
          })
          return { isInserting }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isInserting).toBe(false)
    })
  })

  describe('draggedNoteId 變化', () => {
    it('draggedNoteId 從 null 變為有值時應設定監聽器', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const draggedNoteId = ref<string | null>(null)

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { result, draggedNoteId }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 初始時不應設定監聽器
      expect(addEventListenerSpy).not.toHaveBeenCalled()

      // 改變 draggedNoteId 為有值
      draggedNoteId.value = 'note-1'
      await wrapper.vm.$nextTick()

      // 應該設定監聽器
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), { capture: true })
    })

    it('draggedNoteId 從有值變為另一個值時監聽器保持啟用', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const result = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { result, draggedNoteId }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 改變 draggedNoteId 為另一個值
      draggedNoteId.value = 'note-2'
      await wrapper.vm.$nextTick()

      // 監聽器不應該被移除，因為 draggedNoteId 仍然有值
      expect(removeEventListenerSpy).not.toHaveBeenCalled()

      // 驗證使用新的 noteId 可以正常 drop
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)

      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      expect(onDropMock).toHaveBeenCalledWith('note-2')
    })
  })

  describe('清理後狀態重置', () => {
    it('清理監聽器時應重置 isDropTarget 為 false', async () => {
      const draggedNoteId = ref<string | null>('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: vi.fn(),
          })
          return { isDropTarget, draggedNoteId }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 先移動到範圍內，讓 isDropTarget 為 true
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(true)

      // 改變 draggedNoteId 為 null，觸發清理
      draggedNoteId.value = null
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(false)
    })

    it('drop 完成後應重置 isDropTarget 為 false', async () => {
      const onDropMock = vi.fn()
      const draggedNoteId = ref('note-1')

      const TestComponent = defineComponent({
        setup() {
          const slotElement = createMockSlotElement()
          const slotRef = ref<HTMLElement | null>(slotElement)
          const { isDropTarget } = useSlotDropTarget({
            slotRef,
            draggedNoteId: () => draggedNoteId.value,
            validateDrop: () => true,
            onDrop: onDropMock,
          })
          return { isDropTarget }
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComponent)

      // 先移動到範圍內
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(mouseMoveEvent)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(true)

      // 然後 mouseup
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isDropTarget).toBe(false)
    })
  })
})
