import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { useViewportStore } from '@/stores/pod/viewportStore'

describe('viewportStore', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
  })

  describe('初始狀態', () => {
    it('offset 應為 {x: 0, y: 0}', () => {
      const store = useViewportStore()

      expect(store.offset).toEqual({ x: 0, y: 0 })
    })

    it('zoom 應為 1', () => {
      const store = useViewportStore()

      expect(store.zoom).toBe(1)
    })
  })

  describe('screenToCanvas', () => {
    it('zoom 為 1、offset 為 0 時，螢幕座標應等於畫布座標', () => {
      const store = useViewportStore()

      const result = store.screenToCanvas(100, 200)

      expect(result).toEqual({ x: 100, y: 200 })
    })

    it('有 offset 時應正確轉換', () => {
      const store = useViewportStore()
      store.setOffset(50, 30)

      const result = store.screenToCanvas(100, 200)

      // (100 - 50) / 1 = 50, (200 - 30) / 1 = 170
      expect(result).toEqual({ x: 50, y: 170 })
    })

    it('zoom 為 2 時應正確縮放轉換', () => {
      const store = useViewportStore()
      store.zoom = 2
      store.setOffset(0, 0)

      const result = store.screenToCanvas(100, 200)

      // (100 - 0) / 2 = 50, (200 - 0) / 2 = 100
      expect(result).toEqual({ x: 50, y: 100 })
    })

    it('同時有 offset 和 zoom 時應正確轉換', () => {
      const store = useViewportStore()
      store.zoom = 2
      store.setOffset(20, 40)

      const result = store.screenToCanvas(120, 240)

      // (120 - 20) / 2 = 50, (240 - 40) / 2 = 100
      expect(result).toEqual({ x: 50, y: 100 })
    })
  })

  describe('setOffset', () => {
    it('應設定 offset x 和 y', () => {
      const store = useViewportStore()

      store.setOffset(100, 200)

      expect(store.offset).toEqual({ x: 100, y: 200 })
    })

    it('應能夠設定負數 offset', () => {
      const store = useViewportStore()

      store.setOffset(-50, -75)

      expect(store.offset).toEqual({ x: -50, y: -75 })
    })

    it('應能夠多次設定 offset', () => {
      const store = useViewportStore()

      store.setOffset(100, 200)
      expect(store.offset).toEqual({ x: 100, y: 200 })

      store.setOffset(300, 400)
      expect(store.offset).toEqual({ x: 300, y: 400 })
    })
  })

  describe('zoomTo', () => {
    it('應以指定點為中心縮放', () => {
      const store = useViewportStore()
      store.setOffset(0, 0)
      store.zoom = 1

      // 以 (100, 100) 為中心，縮放到 2
      store.zoomTo(2, 100, 100)

      expect(store.zoom).toBe(2)
      // offset 應調整使 (100, 100) 保持在相同畫布位置
      // newOffset.x = centerX - (dx * newZoom) / oldZoom
      // newOffset.x = 100 - (100 * 2) / 1 = 100 - 200 = -100
      expect(store.offset).toEqual({ x: -100, y: -100 })
    })

    it('應限制在 MIN_ZOOM(0.1) 到 MAX_ZOOM(3) 之間', () => {
      const store = useViewportStore()

      // 測試上限
      store.zoomTo(5, 100, 100)
      expect(store.zoom).toBe(3)

      // 重置
      store.zoom = 1
      store.setOffset(0, 0)

      // 測試下限
      store.zoomTo(0.05, 100, 100)
      expect(store.zoom).toBe(0.1)
    })

    it('zoom 大於 3 時應限制為 3', () => {
      const store = useViewportStore()
      store.setOffset(0, 0)
      store.zoom = 1

      store.zoomTo(10, 100, 100)

      expect(store.zoom).toBe(3)
    })

    it('zoom 小於 0.1 時應限制為 0.1', () => {
      const store = useViewportStore()
      store.setOffset(0, 0)
      store.zoom = 1

      store.zoomTo(0.01, 100, 100)

      expect(store.zoom).toBe(0.1)
    })

    it('應正確計算縮放後的 offset', () => {
      const store = useViewportStore()
      store.setOffset(50, 50)
      store.zoom = 1

      // 以 (200, 200) 為中心，縮放到 2
      store.zoomTo(2, 200, 200)

      expect(store.zoom).toBe(2)
      // dx = 200 - 50 = 150, dy = 200 - 50 = 150
      // newOffset.x = 200 - (150 * 2) / 1 = 200 - 300 = -100
      expect(store.offset).toEqual({ x: -100, y: -100 })
    })

    it('當 zoom 為邊界值時應正確計算 offset', () => {
      const store = useViewportStore()
      store.setOffset(100, 100)
      store.zoom = 2

      // 以 (300, 300) 為中心，縮放到 0.05 (會被限制為 0.1)
      store.zoomTo(0.05, 300, 300)

      expect(store.zoom).toBe(0.1)
      // dx = 300 - 100 = 200, dy = 300 - 100 = 200
      // newOffset.x = 300 - (200 * 0.1) / 2 = 300 - 10 = 290
      expect(store.offset).toEqual({ x: 290, y: 290 })
    })
  })

  describe('resetToCenter', () => {
    it('應將 offset 設為視窗中心', () => {
      const store = useViewportStore()
      store.setOffset(100, 200)
      store.zoom = 2

      store.resetToCenter()

      expect(store.offset.x).toBe(window.innerWidth / 2)
      expect(store.offset.y).toBe(window.innerHeight / 2)
    })

    it('應將 zoom 設為 0.75', () => {
      const store = useViewportStore()
      store.zoom = 2

      store.resetToCenter()

      expect(store.zoom).toBe(0.75)
    })

    it('應同時設定 offset 和 zoom', () => {
      const store = useViewportStore()
      store.setOffset(999, 999)
      store.zoom = 3

      store.resetToCenter()

      expect(store.offset.x).toBe(window.innerWidth / 2)
      expect(store.offset.y).toBe(window.innerHeight / 2)
      expect(store.zoom).toBe(0.75)
    })
  })
})
