import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { useDragHandler } from '@/composables/useDragHandler'

describe('useDragHandler', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 確保清理殘留監聽器
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('startDrag 後應設定 isDragging 為 true', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { startDrag, isDragging } = useDragHandler({ onMove, onEnd })

    const event = new MouseEvent('mousedown', { button: 0 })
    startDrag(event)

    expect(isDragging.value).toBe(true)
  })

  it('mousemove 時應呼叫 onMove callback', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { startDrag } = useDragHandler({ onMove, onEnd })

    const startEvent = new MouseEvent('mousedown', { button: 0 })
    startDrag(startEvent)

    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 })
    document.dispatchEvent(moveEvent)

    expect(onMove).toHaveBeenCalledWith(moveEvent)
  })

  it('mouseup 時應呼叫 onEnd callback 並設定 isDragging 為 false', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { startDrag, isDragging } = useDragHandler({ onMove, onEnd })

    const startEvent = new MouseEvent('mousedown', { button: 0 })
    startDrag(startEvent)

    const upEvent = new MouseEvent('mouseup')
    document.dispatchEvent(upEvent)

    expect(onEnd).toHaveBeenCalledWith(upEvent)
    expect(isDragging.value).toBe(false)
  })

  it('mouseup 後應移除 mousemove 和 mouseup 監聽器', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { startDrag } = useDragHandler({ onMove, onEnd })

    const startEvent = new MouseEvent('mousedown', { button: 0 })
    startDrag(startEvent)

    document.dispatchEvent(new MouseEvent('mouseup'))

    vi.clearAllMocks()

    document.dispatchEvent(new MouseEvent('mousemove'))

    expect(onMove).not.toHaveBeenCalled()
  })

  it('非左鍵按下時不應啟動拖曳', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { startDrag, isDragging } = useDragHandler({ onMove, onEnd })

    const rightClickEvent = new MouseEvent('mousedown', { button: 2 })
    startDrag(rightClickEvent)

    expect(isDragging.value).toBe(false)

    document.dispatchEvent(new MouseEvent('mousemove'))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('onUnmounted 時應清理未完成的拖曳事件監聽器', async () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()

    const { useDragHandler: localUseDragHandler } = await import('@/composables/useDragHandler')

    const { createApp, defineComponent, onMounted } = await import('vue')

    let cleanupCalled = false
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {
      cleanupCalled = true
    })

    const TestComponent = defineComponent({
      setup() {
        const { startDrag } = localUseDragHandler({ onMove, onEnd })
        onMounted(() => {
          const event = new MouseEvent('mousedown', { button: 0 })
          startDrag(event)
        })
      },
      template: '<div></div>'
    })

    const app = createApp(TestComponent)
    const div = document.createElement('div')
    document.body.appendChild(div)
    app.mount(div)

    app.unmount()
    document.body.removeChild(div)

    expect(removeEventListenerSpy).toHaveBeenCalled()
    expect(cleanupCalled).toBe(true)
    removeEventListenerSpy.mockRestore()
  })
})
