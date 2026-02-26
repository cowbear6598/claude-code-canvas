import {defineStore} from 'pinia'
import type {ModelType, Pod, PodStatus, Position, Schedule, TypeMenuState} from '@/types'
import {initialPods} from '@/data/initialPods'
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
import {useToast} from '@/composables/useToast'
import {sanitizeErrorForUser} from '@/utils/errorSanitizer'
import {isValidPod as isValidPodFn, enrichPod as enrichPodFn} from '@/lib/podValidation'
import {requireActiveCanvas, getActiveCanvasIdOrWarn} from '@/utils/canvasGuard'

const MAX_COORD = 100000

/** 選單關閉後的冷卻時間（毫秒），防止同一次滑鼠操作關閉後立刻重開 */
const TYPE_MENU_COOLDOWN_MS = 300

interface PodStoreState {
    pods: Pod[]
    selectedPodId: string | null
    activePodId: string | null
    typeMenu: TypeMenuState
    typeMenuClosedAt: number
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
        typeMenuClosedAt: 0,
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
            return enrichPodFn(pod, existingOutput)
        },

        isValidPod(pod: Pod): boolean {
            return isValidPodFn(pod)
        },

        addPod(pod: Pod): void {
            if (this.isValidPod(pod)) {
                this.pods.push(pod)
            }
        },

        updatePod(pod: Pod): void {
            const index = this.pods.findIndex((p) => p.id === pod.id)
            if (index === -1) return

            const existing = this.pods[index]
            const mergedPod = {
                ...pod,
                output: pod.output !== undefined ? pod.output : existing.output,
            }

            if (!this.isValidPod(mergedPod)) {
                console.warn('[PodStore] updatePod 驗證失敗，已忽略更新', { podId: pod.id })
                return
            }
            this.pods.splice(index, 1, mergedPod)
        },

        async createPodWithBackend(pod: Omit<Pod, 'id'>): Promise<Pod | null> {
            const canvasId = requireActiveCanvas()
            const { showSuccessToast, showErrorToast } = useToast()

            try {
                const response = await createWebSocketRequest<PodCreatePayload, PodCreatedPayload>({
                    requestEvent: WebSocketRequestEvents.POD_CREATE,
                    responseEvent: WebSocketResponseEvents.POD_CREATED,
                    payload: {
                        canvasId,
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

                showSuccessToast('Pod', '建立成功', pod.name)

                return {
                    ...response.pod,
                    x: pod.x,
                    y: pod.y,
                    rotation: pod.rotation,
                    output: pod.output || [],
                }
            } catch (error) {
                const message = sanitizeErrorForUser(error)
                showErrorToast('Pod', '建立失敗', message)
                throw error
            }
        },

        async deletePodWithBackend(id: string): Promise<void> {
            const canvasStore = useCanvasStore()
            const { showSuccessToast, showErrorToast } = useToast()

            const pod = this.pods.find((p) => p.id === id)
            const podName = pod?.name || 'Pod'

            try {
                await createWebSocketRequest<PodDeletePayload, PodDeletedPayload>({
                    requestEvent: WebSocketRequestEvents.POD_DELETE,
                    responseEvent: WebSocketResponseEvents.POD_DELETED,
                    payload: {
                        canvasId: canvasStore.activeCanvasId!,
                        podId: id
                    }
                })

                showSuccessToast('Pod', '刪除成功', podName)
            } catch (error) {
                const message = sanitizeErrorForUser(error)
                showErrorToast('Pod', '刪除失敗', message)
                throw error
            }
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
            const canvasId = getActiveCanvasIdOrWarn('PodStore')
            if (!canvasId) return

            const response = await createWebSocketRequest<PodListPayload, PodListResultPayload>({
                requestEvent: WebSocketRequestEvents.POD_LIST,
                responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
                payload: {
                    canvasId
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

            const safeX = Number.isFinite(x) ? Math.max(-MAX_COORD, Math.min(MAX_COORD, x)) : pod.x
            const safeY = Number.isFinite(y) ? Math.max(-MAX_COORD, Math.min(MAX_COORD, y)) : pod.y

            pod.x = safeX
            pod.y = safeY
        },

        syncPodPosition(id: string): void {
            const pod = this.pods.find((p) => p.id === id)
            if (!pod) return

            const canvasId = getActiveCanvasIdOrWarn('PodStore')
            if (!canvasId) return

            websocketClient.emit<PodMovePayload>(WebSocketRequestEvents.POD_MOVE, {
                requestId: generateRequestId(),
                canvasId,
                podId: id,
                x: pod.x,
                y: pod.y
            })
        },

        async renamePodWithBackend(podId: string, name: string): Promise<void> {
            const canvasId = requireActiveCanvas()
            const { showSuccessToast, showErrorToast } = useToast()

            try {
                await createWebSocketRequest<PodRenamePayload, PodRenamedPayload>({
                    requestEvent: WebSocketRequestEvents.POD_RENAME,
                    responseEvent: WebSocketResponseEvents.POD_RENAMED,
                    payload: {
                        canvasId,
                        podId,
                        name
                    }
                })

                showSuccessToast('Pod', '重新命名成功', name)
            } catch (error) {
                const message = sanitizeErrorForUser(error)
                showErrorToast('Pod', '重新命名失敗', message)
                throw error
            }
        },

        async setScheduleWithBackend(podId: string, schedule: Schedule | null): Promise<Pod | null> {
            const canvasId = requireActiveCanvas()
            const { showSuccessToast } = useToast()

            const response = await createWebSocketRequest<PodSetSchedulePayload, PodScheduleSetPayload>({
                requestEvent: WebSocketRequestEvents.POD_SET_SCHEDULE,
                responseEvent: WebSocketResponseEvents.POD_SCHEDULE_SET,
                payload: {
                    canvasId,
                    podId,
                    schedule
                }
            })

            if (response.success && response.pod) {
                const action = schedule === null ? '清除成功' : '更新成功'
                showSuccessToast('Schedule', action)
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
            // 選單剛被關閉時（同一次滑鼠操作），不重新打開
            if (Date.now() - this.typeMenuClosedAt < TYPE_MENU_COOLDOWN_MS) return

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
            this.typeMenuClosedAt = Date.now()
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
            const canvasId = requireActiveCanvas()
            const { showSuccessToast } = useToast()

            const response = await createWebSocketRequest<PodSetAutoClearPayload, PodAutoClearSetPayload>({
                requestEvent: WebSocketRequestEvents.POD_SET_AUTO_CLEAR,
                responseEvent: WebSocketResponseEvents.POD_AUTO_CLEAR_SET,
                payload: {
                    canvasId,
                    podId,
                    autoClear
                }
            })

            if (response.success && response.pod) {
                showSuccessToast('Pod', '設定成功')
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
