import { defineStore } from 'pinia'
import type { Position } from '@/types'
import { POD_WIDTH, POD_HEIGHT } from '@/lib/constants'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3

interface ViewportState {
  offset: Position
  zoom: number
}

export const useViewportStore = defineStore('viewport', {
  state: (): ViewportState => ({
    offset: { x: 0, y: 0 },
    zoom: 1,
  }),

  getters: {
    /**
     * 將螢幕座標轉換為畫布座標
     */
    screenToCanvas: (state) => (screenX: number, screenY: number): Position => {
      return {
        x: (screenX - state.offset.x) / state.zoom,
        y: (screenY - state.offset.y) / state.zoom,
      }
    },
  },

  actions: {
    /**
     * 設定視口偏移量
     */
    setOffset(x: number, y: number): void {
      this.offset = { x, y }
    },

    /**
     * 縮放到指定縮放級別，以指定點為中心
     */
    zoomTo(zoom: number, centerX: number, centerY: number): void {
      const oldZoom = this.zoom
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

      const dx = centerX - this.offset.x
      const dy = centerY - this.offset.y

      this.offset.x = centerX - (dx * newZoom) / oldZoom
      this.offset.y = centerY - (dy * newZoom) / oldZoom
      this.zoom = newZoom
    },

    /**
     * 縮放視口，讓所有 POD 都可見
     *
     * @param pods - Pod 列表，作為參數傳入以避免跨 Store 依賴
     */
    fitToAllPods(pods: Array<{ x: number; y: number }>): void {
      if (pods.length === 0) return

      const PADDING_X = 50
      const PADDING_TOP = 80
      const PADDING_BOTTOM = 50

      // 計算所有 POD 的邊界
      const minX = Math.min(...pods.map(p => p.x))
      const minY = Math.min(...pods.map(p => p.y))
      const maxX = Math.max(...pods.map(p => p.x + POD_WIDTH))
      const maxY = Math.max(...pods.map(p => p.y + POD_HEIGHT))

      // 計算內容的寬高（含 padding）
      const contentWidth = maxX - minX + PADDING_X * 2
      const contentHeight = maxY - minY + PADDING_TOP + PADDING_BOTTOM

      // 可見區域
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight

      // 計算適合的縮放比例
      const zoomX = screenWidth / contentWidth
      const zoomY = screenHeight / contentHeight
      const zoom = Math.min(zoomX, zoomY, 1)
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

      // 計算 offset，讓內容對齊可見區域
      const offsetX = -minX * clampedZoom + PADDING_X
      const offsetY = -minY * clampedZoom + PADDING_TOP

      this.zoom = clampedZoom
      this.offset = { x: offsetX, y: offsetY }
    },

    resetToCenter(): void {
      this.offset.x = window.innerWidth / 2
      this.offset.y = window.innerHeight / 2
      this.zoom = 0.75
    },
  },
})
