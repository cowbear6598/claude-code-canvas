import {defineStore} from 'pinia'
import type {Pod, PodColor, Position, TypeMenuState, ViewportState} from '@/types'
import {initialPods} from '@/data/initialPods'
import {validatePodName} from '@/lib/sanitize'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const MAX_COORD = 100000

interface CanvasState {
    pods: Pod[]
    selectedPodId: string | null
    activePodId: string | null
    typeMenu: TypeMenuState
    viewport: ViewportState
}

export const useCanvasStore = defineStore('canvas', {
    state: (): CanvasState => ({
        pods: initialPods,
        selectedPodId: null,
        activePodId: null,
        typeMenu: {
            visible: false,
            position: null,
        },
        viewport: {
            offset: {x: 0, y: 0},
            zoom: 1,
        },
    }),

    getters: {
        selectedPod: (state): Pod | null =>
            state.pods.find((p) => p.id === state.selectedPodId) || null,

        podCount: (state): number => state.pods.length,
    },

    actions: {
        isValidPod(pod: Pod): boolean {
            const validColors: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green']
            return (
                validatePodName(pod.name) &&
                Array.isArray(pod.output) &&
                pod.id.trim() !== '' &&
                validColors.includes(pod.color) &&
                isFinite(pod.x) &&
                isFinite(pod.y) &&
                isFinite(pod.rotation)
            )
        },

        addPod(pod: Pod): void {
            if (this.isValidPod(pod)) {
                this.pods.push(pod)
            }
        },

        updatePod(pod: Pod): void {
            if (!this.isValidPod(pod)) return
            const index = this.pods.findIndex((p) => p.id === pod.id)
            if (index !== -1) {
                this.pods[index] = pod
            }
        },

        deletePod(id: string): void {
            this.pods = this.pods.filter((p) => p.id !== id)
            if (this.selectedPodId === id) {
                this.selectedPodId = null
            }
            if (this.activePodId === id) {
                this.activePodId = null
            }
        },

        movePod(id: string, x: number, y: number): void {
            const pod = this.pods.find((p) => p.id === id)
            if (pod) {
                // 驗證座標有效性
                if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                    return
                }
                // 限制座標範圍
                pod.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, x))
                pod.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, y))
            }
        },

        selectPod(podId: string | null): void {
            this.selectedPodId = podId
        },

        setActivePod(podId: string | null): void {
            this.activePodId = podId
        },

        showTypeMenu(position: Position): void {
            this.typeMenu = {
                visible: true,
                position,
            }
        },

        hideTypeMenu(): void {
            this.typeMenu = {
                visible: false,
                position: null,
            }
        },

        setOffset(x: number, y: number): void {
            this.viewport.offset = {x, y}
        },

        setZoom(zoom: number): void {
            this.viewport.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
        },

        panBy(dx: number, dy: number): void {
            this.viewport.offset.x += dx
            this.viewport.offset.y += dy
        },

        zoomTo(zoom: number, centerX: number, centerY: number): void {
            const oldZoom = this.viewport.zoom
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

            const dx = centerX - this.viewport.offset.x
            const dy = centerY - this.viewport.offset.y

            this.viewport.offset.x = centerX - (dx * newZoom) / oldZoom
            this.viewport.offset.y = centerY - (dy * newZoom) / oldZoom
            this.viewport.zoom = newZoom
        },

        resetView(): void {
            this.viewport = {
                offset: {x: 0, y: 0},
                zoom: 1,
            }
        },
    },
})
