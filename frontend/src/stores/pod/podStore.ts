import { defineStore } from 'pinia'
import type { Pod, PodColor, PodStatus, Position, TypeMenuState, ModelType } from '@/types'
import { initialPods } from '@/data/initialPods'
import { validatePodName } from '@/lib/sanitize'
import { generateRequestId } from '@/services/utils'
import { websocketClient, createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type {
  PodCreatedPayload,
  PodDeletedPayload,
  PodListResultPayload,
  PodCreatePayload,
  PodDeletePayload,
  PodListPayload,
  PodUpdatePayload,
  PodJoinPayload,
  PodLeavePayload
} from '@/types/websocket'
import { useConnectionStore } from '@/stores/connectionStore'
import { POSITION_SYNC_DELAY_MS } from '@/lib/constants'

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
    /**
     * 取得選中的 Pod
     */
    selectedPod: (state): Pod | null =>
      state.pods.find((p) => p.id === state.selectedPodId) || null,

    /**
     * Pod 總數
     */
    podCount: (state): number => state.pods.length,

    /**
     * 根據 ID 取得 Pod
     */
    getPodById: (state) => (id: string): Pod | undefined => {
      return state.pods.find((p) => p.id === id)
    },
  },

  actions: {
    /**
     * 驗證 Pod 資料是否合法
     */
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

    /**
     * 新增 Pod（本地）
     */
    addPod(pod: Pod): void {
      if (this.isValidPod(pod)) {
        this.pods.push(pod)
      }
    },

    /**
     * 更新 Pod（本地）
     */
    updatePod(pod: Pod): void {
      if (!this.isValidPod(pod)) return
      const index = this.pods.findIndex((p) => p.id === pod.id)
      if (index !== -1) {
        // 使用 splice 確保 Vue 響應式系統正確追蹤變化
        this.pods.splice(index, 1, pod)
      }
    },

    /**
     * 刪除 Pod（本地）
     */
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
     * 建立 Pod 並同步到後端
     */
    async createPodWithBackend(pod: Omit<Pod, 'id'>): Promise<Pod | null> {
      const response = await createWebSocketRequest<PodCreatePayload, PodCreatedPayload>({
        requestEvent: WebSocketRequestEvents.POD_CREATE,
        responseEvent: WebSocketResponseEvents.POD_CREATED,
        payload: {
          name: pod.name,
          type: pod.type,
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
      websocketClient.emit<PodJoinPayload>(WebSocketRequestEvents.POD_JOIN, { podId: frontendPod.id })

      return frontendPod
    },

    /**
     * 刪除 Pod 並同步到後端
     */
    async deletePodWithBackend(id: string): Promise<void> {
      await createWebSocketRequest<PodDeletePayload, PodDeletedPayload>({
        requestEvent: WebSocketRequestEvents.POD_DELETE,
        responseEvent: WebSocketResponseEvents.POD_DELETED,
        payload: {
          podId: id
        }
      })

      websocketClient.emit<PodLeavePayload>(WebSocketRequestEvents.POD_LEAVE, { podId: id })
      this.deletePod(id)
    },

    /**
     * 從後端同步 Pods（取代本地 Pods）
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
     * 從後端載入 Pods
     */
    async loadPodsFromBackend(): Promise<void> {
      const response = await createWebSocketRequest<PodListPayload, PodListResultPayload>({
        requestEvent: WebSocketRequestEvents.POD_LIST,
        responseEvent: WebSocketResponseEvents.POD_LIST_RESULT,
        payload: {}
      })

      if (response.pods) {
        this.syncPodsFromBackend(response.pods)
      }
    },

    /**
     * 更新 Pod 狀態
     */
    updatePodStatus(id: string, status: PodStatus): void {
      const pod = this.pods.find((p) => p.id === id)
      if (pod) {
        pod.status = status
      }
    },

    /**
     * 更新 Pod Git URL
     */
    updatePodGitUrl(id: string, gitUrl: string): void {
      const pod = this.pods.find((p) => p.id === id)
      if (pod) {
        pod.gitUrl = gitUrl
      }
    },

    /**
     * 移動 Pod
     */
    movePod(id: string, x: number, y: number): void {
      const pod = this.pods.find((p) => p.id === id)
      if (!pod) return

      // 驗證座標有效性
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        return
      }
      // 限制座標範圍
      pod.x = Math.max(-MAX_COORD, Math.min(MAX_COORD, x))
      pod.y = Math.max(-MAX_COORD, Math.min(MAX_COORD, y))

      // Sync position to backend (debounced)
      this.debouncedSyncPodPosition(id, pod.x, pod.y)
    },

    /**
     * 防抖同步 Pod 位置到後端
     */
    debouncedSyncPodPosition(id: string, x: number, y: number): void {
      if (this.syncTimers[id]) {
        clearTimeout(this.syncTimers[id])
      }

      this.syncTimers[id] = setTimeout(() => {
        websocketClient.emit<PodUpdatePayload>(WebSocketRequestEvents.POD_UPDATE, {
          requestId: generateRequestId(),
          podId: id,
          x,
          y
        })
        delete this.syncTimers[id]
      }, POSITION_SYNC_DELAY_MS)
    },

    /**
     * 選擇 Pod
     */
    selectPod(podId: string | null): void {
      this.selectedPodId = podId
    },

    /**
     * 設定活躍的 Pod
     */
    setActivePod(podId: string | null): void {
      this.activePodId = podId
    },

    /**
     * 顯示類型選單
     */
    showTypeMenu(position: Position): void {
      this.typeMenu = {
        visible: true,
        position,
      }
    },

    /**
     * 隱藏類型選單
     */
    hideTypeMenu(): void {
      this.typeMenu = {
        visible: false,
        position: null,
      }
    },

    /**
     * 更新 Pod 的 OutputStyle
     */
    updatePodOutputStyle(podId: string, outputStyleId: string | null): void {
      const pod = this.pods.find((p) => p.id === podId)
      if (pod) {
        pod.outputStyleId = outputStyleId
      }
    },

    /**
     * 清除指定 Pods 的輸出
     */
    clearPodOutputsByIds(podIds: string[]): void {
      for (const podId of podIds) {
        const pod = this.pods.find((p) => p.id === podId)
        if (pod) {
          pod.output = []
        }
      }
    },

    /**
     * 更新 Pod 的模型
     */
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
  },
})
