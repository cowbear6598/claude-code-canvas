import {defineStore} from 'pinia'
import type {Pod, PodColor, PodStatus, Position, TypeMenuState, ModelType} from '@/types'
import {initialPods} from '@/data/initialPods'
import {validatePodName} from '@/lib/sanitize'
import {generateRequestId} from '@/services/utils'
import {
    websocketClient,
    createWebSocketRequest,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import type {
    PodCreatedPayload,
    PodDeletedPayload,
    PodListResultPayload,
    PodCreatePayload,
    PodDeletePayload,
    PodListPayload,
    PodUpdatePayload,
    PodJoinPayload,
    PodLeavePayload,
    PodSetAutoClearPayload,
    PodAutoClearSetPayload
} from '@/types/websocket'
import {useConnectionStore} from '@/stores/connectionStore'
import {useCanvasStore} from '@/stores/canvasStore'
import {POSITION_SYNC_DELAY_MS} from '@/lib/constants'

const MAX_COORD = 100000

interface PodStoreState {
    pods: Pod[]
    selectedPodId: string | null
    activePodId: string | null
    typeMenu: TypeMenuState
    syncTimers: Record<string, ReturnType<typeof setTimeout>>
}

export const usePodStore = defineStore('pod', {
    state: (): PodStoreState => ({
        pods: initialPods,
        selectedPodId: null,
        activePodId: null,
        typeMenu: {
            visible: false,
            position: null,
        },
        syncTimers: {},
    }),

    getters: {
        selectedPod: (state): Pod | null =>
            state.pods.find((p) => p.id === state.selectedPodId) || null,

        podCount: (state): number => state.pods.length,

        getPodById: (state) => (id: string): Pod | undefined => {
            return state.pods.find((p) => p.id === id)
        },
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
                const oldPod = this.pods[index]
                if (!oldPod) return

                this.pods.splice(index, 1, pod)

                // Sync name change to backend
                if (oldPod.name !== pod.name) {
                    const canvasStore = useCanvasStore()
                    websocketClient.emit<PodUpdatePayload>(WebSocketRequestEvents.POD_UPDATE, {
                        requestId: generateRequestId(),
                        canvasId: canvasStore.activeCanvasId!,
                        podId: pod.id,
                        name: pod.name
                    })
                }
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

            const connectionStore = useConnectionStore()
            connectionStore.deleteConnectionsByPodId(id)
        },

        async createPodWithBackend(pod: Omit<Pod, 'id'>): Promise<Pod | null> {
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                throw new Error('Cannot create pod: no active canvas')
            }

            const response = await createWebSocketRequest<PodCreatePayload, PodCreatedPayload>({
                requestEvent: WebSocketRequestEvents.POD_CREATE,
                responseEvent: WebSocketResponseEvents.POD_CREATED,
                payload: {
                    canvasId: canvasStore.activeCanvasId,
                    name: pod.name,
                    color: pod.color,
                    x: pod.x,
                    y: pod.y,
                    rotation: pod.rotation
                }
            })

            if (!response.pod) {
                throw new Error('Pod creation failed: no pod returned')
            }

            const frontendPod: Pod = {
                ...response.pod,
                x: pod.x,
                y: pod.y,
                rotation: pod.rotation,
                output: pod.output || [],
            }

            this.addPod(frontendPod)
            websocketClient.emit<PodJoinPayload>(WebSocketRequestEvents.POD_JOIN, {
                canvasId: canvasStore.activeCanvasId!,
                podId: frontendPod.id
            })

            return frontendPod
        },

        async deletePodWithBackend(id: string): Promise<void> {
            const canvasStore = useCanvasStore()

            await createWebSocketRequest<PodDeletePayload, PodDeletedPayload>({
                requestEvent: WebSocketRequestEvents.POD_DELETE,
                responseEvent: WebSocketResponseEvents.POD_DELETED,
                payload: {
                    canvasId: canvasStore.activeCanvasId!,
                    podId: id
                }
            })

            websocketClient.emit<PodLeavePayload>(WebSocketRequestEvents.POD_LEAVE, {
                canvasId: canvasStore.activeCanvasId!,
                podId: id
            })
            this.deletePod(id)
        },

        syncPodsFromBackend(pods: Pod[]): void {
            const enrichedPods = pods.map((pod, index) => ({
                ...pod,
                x: pod.x ?? 100 + (index * 300),
                y: pod.y ?? 150 + (index % 2) * 100,
                rotation: pod.rotation ?? (Math.random() * 2 - 1),
                output: pod.output ?? [],
                outputStyleId: pod.outputStyleId ?? null,
                model: pod.model ?? 'opus',
                autoClear: pod.autoClear ?? false,
                commandId: pod.commandId ?? null,
            }))
            this.pods = enrichedPods.filter(pod => this.isValidPod(pod))
        },

        async loadPodsFromBackend(): Promise<void> {
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                console.warn('[PodStore] Cannot load pods: no active canvas')
                return
            }

            const response = await createWebSocketRequest<PodListPayload, PodListResultPayload>({
                requestEvent: WebSocketRequestEvents.POD_LIST,
                responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
                payload: {
                    canvasId: canvasStore.activeCanvasId
                }
            })

            if (response.pods) {
                this.syncPodsFromBackend(response.pods)
            }
        },

        updatePodStatus(id: string, status: PodStatus): void {
            const pod = this.pods.find((p) => p.id === id)
            if (pod) {
                pod.status = status
            }
        },

        movePod(id: string, x: number, y: number): void {
            const pod = this.pods.find((p) => p.id === id)
            if (!pod) return

            if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                return
            }

            pod.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, x))
            pod.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, y))

            this.debouncedSyncPodPosition(id, pod.x, pod.y)
        },

        debouncedSyncPodPosition(id: string, x: number, y: number): void {
            if (this.syncTimers[id]) {
                clearTimeout(this.syncTimers[id])
            }

            this.syncTimers[id] = setTimeout(() => {
                const canvasStore = useCanvasStore()
                websocketClient.emit<PodUpdatePayload>(WebSocketRequestEvents.POD_UPDATE, {
                    requestId: generateRequestId(),
                    canvasId: canvasStore.activeCanvasId!,
                    podId: id,
                    x,
                    y
                })
                delete this.syncTimers[id]
            }, POSITION_SYNC_DELAY_MS)
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

        updatePodOutputStyle(podId: string, outputStyleId: string | null): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.outputStyleId = outputStyleId
            }
        },

        clearPodOutputsByIds(podIds: string[]): void {
            for (const podId of podIds) {
                const pod = this.pods.find((p) => p.id === podId)
                if (pod) {
                    pod.output = []
                }
            }
        },

        updatePodModel(podId: string, model: ModelType): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.model = model
            }
        },

        updatePodRepository(podId: string, repositoryId: string | null): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (!pod) return

            pod.repositoryId = repositoryId
        },

        updatePodCommand(podId: string, commandId: string | null): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (!pod) return

            pod.commandId = commandId
        },

        updatePodAutoClear(podId: string, autoClear: boolean): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.autoClear = autoClear
            }
        },

        async setAutoClearWithBackend(podId: string, autoClear: boolean): Promise<Pod | null> {
            const canvasStore = useCanvasStore()

            const response = await createWebSocketRequest<PodSetAutoClearPayload, PodAutoClearSetPayload>({
                requestEvent: WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
                responseEvent: WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
                payload: {
                    canvasId: canvasStore.activeCanvasId!,
                    podId,
                    autoClear
                }
            })

            if (response.success && response.pod) {
                this.updatePodAutoClear(podId, autoClear)
                return response.pod
            }

            return null
        },

        addPodFromBroadcast(pod: Pod): void {
            const enrichedPod: Pod = {
                ...pod,
                x: pod.x ?? 100,
                y: pod.y ?? 150,
                rotation: pod.rotation ?? (Math.random() * 2 - 1),
                output: pod.output ?? [],
                outputStyleId: pod.outputStyleId ?? null,
                model: pod.model ?? 'opus',
                autoClear: pod.autoClear ?? false,
                commandId: pod.commandId ?? null,
            }

            if (!this.isValidPod(enrichedPod)) return

            this.pods.push(enrichedPod)

            const canvasStore = useCanvasStore()
            websocketClient.emit<PodJoinPayload>(WebSocketRequestEvents.POD_JOIN, {
                canvasId: canvasStore.activeCanvasId!,
                podId: enrichedPod.id
            })
        },

        updatePodFromBroadcast(pod: Pod): void {
            const enrichedPod: Pod = {
                ...pod,
                x: pod.x ?? 100,
                y: pod.y ?? 150,
                rotation: pod.rotation ?? (Math.random() * 2 - 1),
                output: pod.output ?? [],
                outputStyleId: pod.outputStyleId ?? null,
                model: pod.model ?? 'opus',
                autoClear: pod.autoClear ?? false,
                commandId: pod.commandId ?? null,
            }

            if (!this.isValidPod(enrichedPod)) return

            const index = this.pods.findIndex((p) => p.id === pod.id)
            if (index !== -1) {
                this.pods.splice(index, 1, enrichedPod)
            }
        },

        removePodFromBroadcast(podId: string): void {
            this.pods = this.pods.filter((p) => p.id !== podId)

            if (this.selectedPodId === podId) {
                this.selectedPodId = null
            }

            if (this.activePodId === podId) {
                this.activePodId = null
            }

            const connectionStore = useConnectionStore()
            connectionStore.deleteConnectionsByPodId(podId)
        },
    },
})
