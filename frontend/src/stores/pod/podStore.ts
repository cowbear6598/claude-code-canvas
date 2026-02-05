import {defineStore} from 'pinia'
import type {ModelType, Pod, PodColor, PodStatus, Position, Schedule, TypeMenuState} from '@/types'
import {initialPods} from '@/data/initialPods'
import {validatePodName} from '@/lib/sanitize'
import {generateRequestId} from '@/services/utils'
import {
    createWebSocketRequest,
    websocketClient,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import type {
    PodAutoClearSetPayload,
    PodCreatedPayload,
    PodCreatePayload,
    PodDeletedPayload,
    PodDeletePayload,
    PodListPayload,
    PodListResultPayload,
    PodMovePayload,
    PodRenamedPayload,
    PodRenamePayload,
    PodScheduleSetPayload,
    PodSetAutoClearPayload,
    PodSetSchedulePayload
} from '@/types/websocket'
import {useConnectionStore} from '@/stores/connectionStore'
import {useCanvasStore} from '@/stores/canvasStore'

const MAX_COORD = 100000

interface PodStoreState {
    pods: Pod[]
    selectedPodId: string | null
    activePodId: string | null
    typeMenu: TypeMenuState
    scheduleFiredPodIds: Set<string>
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
        scheduleFiredPodIds: new Set(),
    }),

    getters: {
        selectedPod: (state): Pod | null =>
            state.pods.find((p) => p.id === state.selectedPodId) || null,

        podCount: (state): number => state.pods.length,

        getPodById: (state) => (id: string): Pod | undefined => {
            return state.pods.find((p) => p.id === id)
        },

        isScheduleFiredAnimating: (state) => (podId: string): boolean => {
            return state.scheduleFiredPodIds.has(podId)
        },
    },

    actions: {
        enrichPod(pod: Pod, existingOutput?: string[]): Pod {
            return {
                ...pod,
                x: pod.x ?? 100,
                y: pod.y ?? 150,
                rotation: pod.rotation ?? (Math.random() * 2 - 1),
                output: existingOutput ?? pod.output ?? [],
                outputStyleId: pod.outputStyleId ?? null,
                model: pod.model ?? 'opus',
                autoClear: pod.autoClear ?? false,
                commandId: pod.commandId ?? null,
                schedule: pod.schedule ?? null,
            }
        },

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
                this.pods.splice(index, 1, pod)
            }
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

            return {
                ...response.pod,
                x: pod.x,
                y: pod.y,
                rotation: pod.rotation,
                output: pod.output || [],
            }
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
        },

        syncPodsFromBackend(pods: Pod[]): void {
            const enrichedPods = pods.map((pod, index) => {
                const enriched = this.enrichPod(pod)
                return {
                    ...enriched,
                    x: pod.x ?? 100 + (index * 300),
                    y: pod.y ?? 150 + (index % 2) * 100,
                }
            })
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
        },

        syncPodPosition(id: string): void {
            const pod = this.pods.find((p) => p.id === id)
            if (!pod) return

            const canvasStore = useCanvasStore()
            if (!canvasStore.activeCanvasId) return

            websocketClient.emit<PodMovePayload>(WebSocketRequestEvents.POD_MOVE, {
                requestId: generateRequestId(),
                canvasId: canvasStore.activeCanvasId,
                podId: id,
                x: pod.x,
                y: pod.y
            })
        },

        async renamePodWithBackend(podId: string, name: string): Promise<void> {
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                throw new Error('無法重命名 Pod：沒有啟用的畫布')
            }

            await createWebSocketRequest<PodRenamePayload, PodRenamedPayload>({
                requestEvent: WebSocketRequestEvents.POD_RENAME,
                responseEvent: WebSocketResponseEvents.POD_RENAMED,
                payload: {
                    canvasId: canvasStore.activeCanvasId,
                    podId,
                    name
                }
            })
        },

        async setScheduleWithBackend(podId: string, schedule: Schedule | null): Promise<Pod | null> {
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                throw new Error('無法設定排程：沒有啟用的畫布')
            }

            const response = await createWebSocketRequest<PodSetSchedulePayload, PodScheduleSetPayload>({
                requestEvent: WebSocketRequestEvents.POD_SET_SCHEDULE,
                responseEvent: WebSocketResponseEvents.POD_SCHEDULE_SET,
                payload: {
                    canvasId: canvasStore.activeCanvasId,
                    podId,
                    schedule
                }
            })

            if (response.success && response.pod) {
                return response.pod
            }

            return null
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
                return response.pod
            }

            return null
        },

        addPodFromEvent(pod: Pod): void {
            const enrichedPod = this.enrichPod(pod)

            if (!this.isValidPod(enrichedPod)) return

            this.pods.push(enrichedPod)
        },

        removePod(podId: string): void {
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

        updatePodPosition(podId: string, x: number, y: number): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.x = x
                pod.y = y
            }
        },

        updatePodName(podId: string, name: string): void {
            const pod = this.pods.find((p) => p.id === podId)
            if (pod) {
                pod.name = name
            }
        },

        triggerScheduleFiredAnimation(podId: string): void {
            this.scheduleFiredPodIds.delete(podId)
            this.scheduleFiredPodIds = new Set([...this.scheduleFiredPodIds, podId])
        },

        clearScheduleFiredAnimation(podId: string): void {
            this.scheduleFiredPodIds.delete(podId)
            this.scheduleFiredPodIds = new Set(this.scheduleFiredPodIds)
        },
    },
})
