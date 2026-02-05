import {defineStore} from 'pinia'
import type {Position} from '@/types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3

interface ViewportState {
    offset: Position
    zoom: number
}

export const useViewportStore = defineStore('viewport', {
    state: (): ViewportState => ({
        offset: {x: 0, y: 0},
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
            this.offset = {x, y}
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
        resetToCenter(): void {
            this.offset.x = window.innerWidth / 2
            this.offset.y = window.innerHeight / 2
            this.zoom = 0.75
        },
    },
})
