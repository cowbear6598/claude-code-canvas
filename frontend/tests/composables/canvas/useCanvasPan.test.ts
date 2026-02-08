import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { useCanvasPan } from '@/composables/canvas/useCanvasPan'

// Mock useCanvasContext
const mockViewportStore = {
  offset: { x: 0, y: 0 },
  setOffset: vi.fn(),
}

vi.mock('@/composables/canvas/useCanvasContext', () => ({
  useCanvasContext: () => ({
    viewportStore: mockViewportStore,
  }),
}))

describe('useCanvasPan', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockViewportStore.offset = { x: 0, y: 0 }

    // 清理任何可能殘留的事件監聽器
    const upEvent = new MouseEvent('mouseup')
    document.dispatchEvent(upEvent)
  })

  describe('startPan', () => {
    it('非右鍵（button !== 2）不應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      // 左鍵（button = 0）
      const leftClickEvent = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(leftClickEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = leftClickEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(leftClickEvent)

      expect(isPanning.value).toBe(false)
    })

    it('中鍵（button = 1）不應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      const middleClickEvent = new MouseEvent('mousedown', {
        button: 1,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(middleClickEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = middleClickEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(middleClickEvent)

      expect(isPanning.value).toBe(false)
    })

    it('target id 為 canvas 時應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      const event = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = event.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(event)

      expect(isPanning.value).toBe(true)
    })

    it('target class 為 canvas-grid 時應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      const event = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = event.target as HTMLElement
      targetElement.classList.add('canvas-grid')

      startPan(event)

      expect(isPanning.value).toBe(true)
    })

    it('target class 為 canvas-content 時應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      const event = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = event.target as HTMLElement
      targetElement.classList.add('canvas-content')

      startPan(event)

      expect(isPanning.value).toBe(true)
    })

    it('target 非 canvas 相關元素時不應啟動拖曳', () => {
      const { startPan, isPanning } = useCanvasPan()

      const event = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = event.target as HTMLElement
      targetElement.id = 'some-other-element'

      startPan(event)

      expect(isPanning.value).toBe(false)
    })

    it('啟動拖曳時應重置 hasPanned 為 false', () => {
      const { startPan, hasPanned } = useCanvasPan()

      // 先設定 hasPanned 為 true
      const event1 = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(event1, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement1 = event1.target as HTMLElement
      targetElement1.id = 'canvas'

      startPan(event1)

      // 模擬拖曳超過閾值
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 110,
        clientY: 210,
      })
      document.dispatchEvent(moveEvent)

      // 釋放滑鼠
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)

      // 此時 hasPanned 應該為 true，再次啟動時應重置為 false
      const event2 = new MouseEvent('mousedown', {
        button: 2,
        clientX: 150,
        clientY: 150,
      })
      Object.defineProperty(event2, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement2 = event2.target as HTMLElement
      targetElement2.id = 'canvas'

      startPan(event2)

      expect(hasPanned.value).toBe(false)
    })
  })

  describe('拖曳移動', () => {
    it('拖曳時應更新 viewportStore.offset', () => {
      const { startPan } = useCanvasPan()
      mockViewportStore.offset = { x: 50, y: 50 }

      // 啟動拖曳
      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動滑鼠
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
      })
      document.dispatchEvent(moveEvent)

      // 應呼叫 setOffset，dx = 50, dy = 50
      expect(mockViewportStore.setOffset).toHaveBeenCalledWith(100, 100)
    })

    it('多次拖曳移動應累積計算偏移量', () => {
      const { startPan } = useCanvasPan()
      mockViewportStore.offset = { x: 100, y: 200 }

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 第一次移動
      const moveEvent1 = new MouseEvent('mousemove', {
        clientX: 120,
        clientY: 220,
      })
      document.dispatchEvent(moveEvent1)

      expect(mockViewportStore.setOffset).toHaveBeenCalledWith(120, 220)

      // 第二次移動
      const moveEvent2 = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
      })
      document.dispatchEvent(moveEvent2)

      expect(mockViewportStore.setOffset).toHaveBeenCalledWith(150, 250)
    })

    it('負方向拖曳應正確計算偏移量', () => {
      const { startPan } = useCanvasPan()
      mockViewportStore.offset = { x: 100, y: 100 }

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 200,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 往負方向移動
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
      })
      document.dispatchEvent(moveEvent)

      // dx = -50, dy = -50
      expect(mockViewportStore.setOffset).toHaveBeenCalledWith(50, 50)
    })

    it('未啟動拖曳時 mousemove 不應更新 offset', () => {
      useCanvasPan()

      // 直接觸發 mousemove（未先呼叫 startPan）
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
      })
      document.dispatchEvent(moveEvent)

      expect(mockViewportStore.setOffset).not.toHaveBeenCalled()
    })
  })

  describe('拖曳閾值', () => {
    it('拖曳距離超過 3px 時 hasPanned 應為 true（X 軸）', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動 4px（X 軸）
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 104,
        clientY: 200,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)
    })

    it('拖曳距離超過 3px 時 hasPanned 應為 true（Y 軸）', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動 4px（Y 軸）
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 204,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)
    })

    it('拖曳距離超過 3px 時 hasPanned 應為 true（對角線）', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動 4px (X) + 0px (Y)，Math.abs(4) > 3，應該觸發
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 104,
        clientY: 200,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)
    })

    it('拖曳距離未超過 3px 時 hasPanned 應保持 false', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動 2px（未超過閾值）
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 102,
        clientY: 200,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(false)
    })

    it('拖曳距離剛好 3px 時 hasPanned 應保持 false', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 移動剛好 3px
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 103,
        clientY: 200,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(false)
    })

    it('負方向拖曳距離超過 3px 時 hasPanned 應為 true', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 往負方向移動 4px
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 96,
        clientY: 196,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)
    })
  })

  describe('stopPan', () => {
    it('放開滑鼠後 isPanning 應為 false', () => {
      const { startPan, isPanning } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      expect(isPanning.value).toBe(true)

      // 放開滑鼠
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)

      expect(isPanning.value).toBe(false)
    })

    it('放開滑鼠後 hasPanned 不應自動重置', () => {
      const { startPan, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 拖曳超過閾值
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 110,
        clientY: 210,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)

      // 放開滑鼠
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)

      // hasPanned 應保持 true
      expect(hasPanned.value).toBe(true)
    })

    it('放開滑鼠後移動滑鼠不應更新 offset', () => {
      const { startPan } = useCanvasPan()
      mockViewportStore.offset = { x: 0, y: 0 }

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 放開滑鼠
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)

      vi.clearAllMocks()

      // 放開後移動滑鼠
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
      })
      document.dispatchEvent(moveEvent)

      expect(mockViewportStore.setOffset).not.toHaveBeenCalled()
    })
  })

  describe('resetPanState', () => {
    it('應重置 hasPanned 為 false', () => {
      const { startPan, resetPanState, hasPanned } = useCanvasPan()

      const startEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 200,
      })
      Object.defineProperty(startEvent, 'target', {
        value: document.createElement('div'),
        configurable: true,
      })
      const targetElement = startEvent.target as HTMLElement
      targetElement.id = 'canvas'

      startPan(startEvent)

      // 拖曳超過閾值
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 110,
        clientY: 210,
      })
      document.dispatchEvent(moveEvent)

      expect(hasPanned.value).toBe(true)

      // 重置狀態
      resetPanState()

      expect(hasPanned.value).toBe(false)
    })

    it('多次呼叫 resetPanState 不應報錯', () => {
      const { resetPanState } = useCanvasPan()

      expect(() => {
        resetPanState()
        resetPanState()
        resetPanState()
      }).not.toThrow()
    })
  })
})
