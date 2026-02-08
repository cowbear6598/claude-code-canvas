import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useMenuPosition } from '@/composables/useMenuPosition'
import { HEADER_HEIGHT } from '@/lib/constants'

describe('useMenuPosition', () => {
  let originalInnerHeight: number

  beforeEach(() => {
    originalInnerHeight = window.innerHeight
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    })
  })

  describe('選單在畫面下方', () => {
    it('y 座標高 → 選單向上展開', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 800 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.bottom).toBeDefined()
      expect(menuStyle.value.top).toBeUndefined()
      expect(menuStyle.value.transformOrigin).toBe('bottom left')
    })

    it('計算 bottom 位置正確', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 800 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.bottom).toBe('200px')
    })
  })

  describe('選單在畫面上方', () => {
    it('y 座標低 → 選單向下展開', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 200 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.top).toBeDefined()
      expect(menuStyle.value.bottom).toBeUndefined()
      expect(menuStyle.value.transformOrigin).toBe('top left')
    })

    it('計算 top 位置正確', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 200 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.top).toBe('200px')
    })
  })

  describe('選單位置計算', () => {
    it('left 根據 x 座標計算', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 250, y: 200 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.left).toBe('250px')
    })

    it('支援非 ref 的 position', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const { menuStyle } = useMenuPosition({ position: { x: 300, y: 200 } })

      expect(menuStyle.value.left).toBe('300px')
      expect(menuStyle.value.top).toBe('200px')
    })

    it('position 變更時 menuStyle 自動更新', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 200 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.left).toBe('100px')
      expect(menuStyle.value.top).toBe('200px')

      position.value = { x: 300, y: 800 }

      expect(menuStyle.value.left).toBe('300px')
      expect(menuStyle.value.bottom).toBe('200px')
    })
  })

  describe('樣式計算', () => {
    it('包含基本樣式', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      })

      const position = ref({ x: 100, y: 200 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.transform).toBe('scale(0.8)')
      expect(menuStyle.value.boxShadow).toBe('3px 3px 0 var(--doodle-ink)')
    })
  })

  describe('方向判斷邊界', () => {
    it('在分界點上方選擇向下展開', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 900,
      })

      const availableHeight = 900 - HEADER_HEIGHT
      const threshold = HEADER_HEIGHT + availableHeight / 3

      const position = ref({ x: 100, y: threshold - 1 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.top).toBeDefined()
      expect(menuStyle.value.transformOrigin).toBe('top left')
    })

    it('在分界點下方選擇向上展開', () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 900,
      })

      const availableHeight = 900 - HEADER_HEIGHT
      const threshold = HEADER_HEIGHT + availableHeight / 3

      const position = ref({ x: 100, y: threshold + 1 })
      const { menuStyle } = useMenuPosition({ position })

      expect(menuStyle.value.bottom).toBeDefined()
      expect(menuStyle.value.transformOrigin).toBe('bottom left')
    })
  })
})
