import {defineStore} from 'pinia'
import type {Pod, PodColor, Position, TypeMenuState, ViewportState, ModelType} from '@/types'
import {initialPods} from '@/data/initialPods'
import {validatePodName} from '@/lib/sanitize'
import {websocketService} from '@/services/websocket'
import {generateRequestId} from '@/services/utils'
import type {
    PodCreatedPayload,
    PodDeletedPayload,
    PodListResultPayload
} from '@/types/websocket'
import { useConnectionStore } from './connectionStore'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const MAX_COORD = 100000

interface CanvasState {
    pods: Pod[]
    selectedPodId: string | null
    activePodId: string | null
    typeMenu: TypeMenuState
    viewport: ViewportState
    syncTimers: Record<string, ReturnType<typeof setTimeout>>
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
        syncTimers: {},
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
                // 使用 splice 確保 Vue 響應式系統正確追蹤變化
                this.pods.splice(index, 1, pod)
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

            // Delete related connections
            const connectionStore = useConnectionStore()
            connectionStore.deleteConnectionsByPodId(id)
        },

        /**
         * Create pod locally and sync with backend
         */
        async createPodWithBackend(pod: Omit<Pod, 'id'>): Promise<Pod | null> {
            return new Promise((resolve, reject) => {
                const requestId = generateRequestId()

                // Register one-time listener for pod:created event
                const handlePodCreated = (payload: PodCreatedPayload) => {
                    if (payload.requestId === requestId) {
                        websocketService.offPodCreated(handlePodCreated)

                        if (payload.success && payload.pod) {
                            // Merge backend pod with frontend-specific fields
                            const frontendPod: Pod = {
                                ...payload.pod,
                                // Add canvas-specific fields from the original pod data
                                x: pod.x,
                                y: pod.y,
                                rotation: pod.rotation,
                                output: pod.output || [],
                            }
                            // Add pod to local state
                            this.addPod(frontendPod)
                            // Join POD room
                            websocketService.podJoin({ podId: frontendPod.id })
                            resolve(frontendPod)
                        } else {
                            console.error('[CanvasStore] Pod creation failed:', payload.error)
                            reject(new Error(payload.error || 'Unknown error'))
                        }
                    }
                }

                websocketService.onPodCreated(handlePodCreated)

                // Emit pod:create event with canvas position
                websocketService.podCreate({
                    requestId,
                    name: pod.name,
                    type: pod.type,
                    color: pod.color,
                    x: pod.x,
                    y: pod.y,
                    rotation: pod.rotation
                })

                // Set timeout to prevent hanging
                setTimeout(() => {
                    websocketService.offPodCreated(handlePodCreated)
                    reject(new Error('Pod creation timeout'))
                }, 10000)
            })
        },

        /**
         * Delete pod locally and sync with backend
         */
        async deletePodWithBackend(id: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const requestId = generateRequestId()

                // Register one-time listener for pod:deleted event
                const handlePodDeleted = (payload: PodDeletedPayload) => {
                    if (payload.requestId === requestId) {
                        websocketService.offPodDeleted(handlePodDeleted)

                        if (payload.success) {
                            // Leave POD room before deleting
                            websocketService.podLeave({ podId: id })
                            // Delete pod from local state
                            this.deletePod(id)
                            resolve()
                        } else {
                            console.error('[CanvasStore] Pod deletion failed:', payload.error)
                            reject(new Error(payload.error || 'Unknown error'))
                        }
                    }
                }

                websocketService.onPodDeleted(handlePodDeleted)

                // Emit pod:delete event
                websocketService.podDelete({
                    requestId,
                    podId: id
                })

                // Set timeout to prevent hanging
                setTimeout(() => {
                    websocketService.offPodDeleted(handlePodDeleted)
                    reject(new Error('Pod deletion timeout'))
                }, 10000)
            })
        },

        /**
         * Replace local pods with backend pods
         * Adds frontend-specific fields (x, y, rotation, output) if missing
         */
        syncPodsFromBackend(pods: Pod[]): void {
            // Add frontend-specific fields to backend pods
            const enrichedPods = pods.map((pod, index) => ({
                ...pod,
                // Add canvas position if missing (spread out horizontally)
                x: pod.x ?? 100 + (index * 300),
                y: pod.y ?? 150 + (index % 2) * 100,
                rotation: pod.rotation ?? (Math.random() * 2 - 1),
                output: pod.output ?? [],
                outputStyleId: pod.outputStyleId ?? null,
                model: pod.model ?? 'opus',
            }))
            this.pods = enrichedPods.filter(pod => this.isValidPod(pod))
        },

        /**
         * Load pods from backend
         */
        async loadPodsFromBackend(): Promise<void> {
            return new Promise((resolve, reject) => {
                const requestId = generateRequestId()

                // Register one-time listener for pod:list:result event
                const handlePodListResult = (payload: PodListResultPayload) => {
                    if (payload.requestId === requestId) {
                        websocketService.offPodListResult(handlePodListResult)

                        if (payload.success && payload.pods) {
                            this.syncPodsFromBackend(payload.pods)
                            resolve()
                        } else {
                            console.error('[CanvasStore] Pod list failed:', payload.error)
                            reject(new Error(payload.error || 'Unknown error'))
                        }
                    }
                }

                websocketService.onPodListResult(handlePodListResult)

                // Emit pod:list event
                websocketService.podList({
                    requestId
                })

                // Set timeout to prevent hanging
                setTimeout(() => {
                    websocketService.offPodListResult(handlePodListResult)
                    reject(new Error('Pod list timeout'))
                }, 10000)
            })
        },

        /**
         * Update pod status (idle/busy/error)
         */
        updatePodStatus(id: string, status: 'idle' | 'busy' | 'error'): void {
            const pod = this.pods.find((p) => p.id === id)
            if (pod) {
                pod.status = status
            }
        },

        /**
         * Update pod git URL after clone
         */
        updatePodGitUrl(id: string, gitUrl: string): void {
            const pod = this.pods.find((p) => p.id === id)
            if (pod) {
                pod.gitUrl = gitUrl
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

                // Sync position to backend (debounced)
                this.debouncedSyncPodPosition(id, pod.x, pod.y)
            }
        },

        /**
         * Debounced sync pod position to backend
         */
        debouncedSyncPodPosition(id: string, x: number, y: number): void {
            // Clear existing timer for this pod
            if (this.syncTimers[id]) {
                clearTimeout(this.syncTimers[id])
            }

            // Set new timer (500ms debounce)
            this.syncTimers[id] = setTimeout(() => {
                const requestId = generateRequestId()
                websocketService.podUpdate({
                    requestId,
                    podId: id,
                    x,
                    y
                })
                delete this.syncTimers[id]
            }, 500)
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
        zoomTo(zoom: number, centerX: number, centerY: number): void {
            const oldZoom = this.viewport.zoom
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

            const dx = centerX - this.viewport.offset.x
            const dy = centerY - this.viewport.offset.y

            this.viewport.offset.x = centerX - (dx * newZoom) / oldZoom
            this.viewport.offset.y = centerY - (dy * newZoom) / oldZoom
            this.viewport.zoom = newZoom
        },
        updatePodOutputStyle(podId: string, outputStyleId: string | null): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.outputStyleId = outputStyleId
            }
        },

        clearPodOutputsByIds(podIds: string[]): void {
            podIds.forEach(podId => {
                const pod = this.pods.find((p) => p.id === podId)
                if (pod) {
                    pod.output = []
                }
            })
        },

        updatePodModel(podId: string, model: ModelType): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.model = model
            }
        },
    },
})
