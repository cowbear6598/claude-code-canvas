import {defineStore} from 'pinia'
import type {AnchorPosition, Connection, ConnectionStatus, DraggingConnection, TriggerMode} from '@/types/connection'
import {usePodStore} from '@/stores/pod/podStore'
import {
    createWebSocketRequest,
    websocketClient,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
import {requireActiveCanvas, getActiveCanvasIdOrWarn} from '@/utils/canvasGuard'
import {createWorkflowEventHandlers} from './workflowEventHandlers'
import type {
    ConnectionCreatedPayload,
    ConnectionCreatePayload,
    ConnectionDeletedPayload,
    ConnectionDeletePayload,
    ConnectionListPayload,
    ConnectionListResultPayload,
    ConnectionUpdatePayload,
} from '@/types/websocket'

interface RawConnection {
    id: string
    sourcePodId?: string
    sourceAnchor: AnchorPosition
    targetPodId: string
    targetAnchor: AnchorPosition
    createdAt: string
    triggerMode?: 'auto' | 'ai-decide' | 'direct'
    connectionStatus?: string
    decideReason?: string | null
}

function normalizeConnection(raw: RawConnection): Connection {
    return {
        ...raw,
        createdAt: new Date(raw.createdAt),
        triggerMode: (raw.triggerMode ?? 'auto') as TriggerMode,
        status: (raw.connectionStatus as ConnectionStatus) ?? 'idle',
        decideReason: raw.decideReason ?? undefined,
    }
}

const RUNNING_CONNECTION_STATUSES = new Set<ConnectionStatus>([
    'active', 'queued', 'waiting', 'ai-deciding', 'ai-approved'
])

const RUNNING_POD_STATUSES = new Set(['chatting', 'summarizing'])

interface ConnectionState {
    connections: Connection[]
    selectedConnectionId: string | null
    draggingConnection: DraggingConnection | null
}

export const useConnectionStore = defineStore('connection', {
    state: (): ConnectionState => ({
        connections: [],
        selectedConnectionId: null,
        draggingConnection: null,
    }),

    getters: {
        getConnectionsByPodId: (state) => (podId: string): Connection[] => {
            return state.connections.filter(
                conn => conn.sourcePodId === podId || conn.targetPodId === podId
            )
        },

        getOutgoingConnections: (state) => (podId: string): Connection[] => {
            return state.connections.filter(conn => conn.sourcePodId === podId)
        },

        getConnectionsByTargetPodId: (state) => (podId: string): Connection[] => {
            return state.connections.filter(conn => conn.targetPodId === podId)
        },

        selectedConnection: (state): Connection | null => {
            if (!state.selectedConnectionId) return null
            return state.connections.find(connection => connection.id === state.selectedConnectionId) || null
        },

        isSourcePod: (state) => (podId: string): boolean => {
            return !state.connections.some(conn => conn.targetPodId === podId)
        },

        hasUpstreamConnections: (state) => (podId: string): boolean => {
            return state.connections.some(conn => conn.targetPodId === podId)
        },

        getAiDecideConnections: (state): Connection[] => {
            return state.connections.filter(conn => conn.triggerMode === 'ai-decide')
        },

        getAiDecideConnectionsBySourcePodId: (state) => (sourcePodId: string): Connection[] => {
            return state.connections.filter(
                conn => conn.sourcePodId === sourcePodId && conn.triggerMode === 'ai-decide'
            )
        },

        getDirectConnections: (state): Connection[] => {
            return state.connections.filter(conn => conn.triggerMode === 'direct')
        },

        getDirectConnectionsBySourcePodId: (state) => (sourcePodId: string): Connection[] => {
            return state.connections.filter(
                conn => conn.sourcePodId === sourcePodId && conn.triggerMode === 'direct'
            )
        },

        isWorkflowRunning: (state) => (sourcePodId: string): boolean => {
            const podStore = usePodStore()

            const sourcePod = podStore.getPodById(sourcePodId)
            if (sourcePod && RUNNING_POD_STATUSES.has(sourcePod.status ?? '')) return true

            const visited = new Set<string>()
            const queue: string[] = [sourcePodId]
            visited.add(sourcePodId)

            while (queue.length > 0) {
                const currentPodId = queue.shift()!
                const outgoing = state.connections.filter(conn => conn.sourcePodId === currentPodId)

                for (const conn of outgoing) {
                    if (conn.status && RUNNING_CONNECTION_STATUSES.has(conn.status)) return true

                    const targetPod = podStore.getPodById(conn.targetPodId)
                    if (targetPod && RUNNING_POD_STATUSES.has(targetPod.status ?? '')) return true

                    if (!visited.has(conn.targetPodId)) {
                        visited.add(conn.targetPodId)
                        queue.push(conn.targetPodId)
                    }
                }
            }

            return false
        },
    },

    actions: {
        findConnectionById(connectionId: string): Connection | undefined {
            return this.connections.find(connection => connection.id === connectionId)
        },

        // Pinia 的 action handler 型別需要統一以 unknown 接收，再由各 handler 自行轉型，
        // 因為 websocketClient.on/off 的 handler 簽章要求型別一致
        getWorkflowEventMap(): Array<[string, (payload: unknown) => void]> {
            return [
                [WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, this.handleWorkflowAutoTriggered as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_COMPLETE, this.handleWorkflowComplete as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_AI_DECIDE_PENDING, this.handleAiDecidePending as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_AI_DECIDE_RESULT, this.handleAiDecideResult as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_AI_DECIDE_ERROR, this.handleAiDecideError as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_AI_DECIDE_CLEAR, this.handleAiDecideClear as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_AI_DECIDE_TRIGGERED, this.handleWorkflowAiDecideTriggered as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_DIRECT_TRIGGERED, this.handleWorkflowDirectTriggered as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_DIRECT_WAITING, this.handleWorkflowDirectWaiting as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_QUEUED, this.handleWorkflowQueued as (payload: unknown) => void],
                [WebSocketResponseEvents.WORKFLOW_QUEUE_PROCESSED, this.handleWorkflowQueueProcessed as (payload: unknown) => void],
            ]
        },

        async loadConnectionsFromBackend(): Promise<void> {
            const canvasId = getActiveCanvasIdOrWarn('ConnectionStore')
            if (!canvasId) return

            const response = await createWebSocketRequest<ConnectionListPayload, ConnectionListResultPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_LIST,
                responseEvent: WebSocketResponseEvents.CONNECTION_LIST_RESULT,
                payload: {
                    canvasId
                }
            })

            if (response.connections) {
                this.connections = response.connections.map(conn => normalizeConnection(conn))
            }
        },

        validateNewConnection(sourcePodId: string | undefined | null, targetPodId: string): boolean {
            if (sourcePodId === targetPodId) {
                console.warn('[ConnectionStore] Cannot connect pod to itself')
                return false
            }

            if (!sourcePodId) return true

            const alreadyConnected = this.connections.some(
                conn => conn.sourcePodId === sourcePodId && conn.targetPodId === targetPodId
            )
            if (alreadyConnected) {
                const {toast} = useToast()
                toast({
                    title: '連線已存在',
                    description: '這兩個 Pod 之間已經有連線了',
                    duration: 3000
                })
                return false
            }

            return true
        },

        async createConnection(
            sourcePodId: string | undefined | null,
            sourceAnchor: AnchorPosition,
            targetPodId: string,
            targetAnchor: AnchorPosition
        ): Promise<Connection | null> {
            if (!this.validateNewConnection(sourcePodId, targetPodId)) return null

            const canvasId = requireActiveCanvas()

            const payload: ConnectionCreatePayload = {
                requestId: '',
                canvasId,
                sourceAnchor,
                targetPodId,
                targetAnchor,
            }

            if (sourcePodId) {
                payload.sourcePodId = sourcePodId
            }

            const response = await createWebSocketRequest<ConnectionCreatePayload, ConnectionCreatedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_CREATE,
                responseEvent: WebSocketResponseEvents.CONNECTION_CREATED,
                payload
            })

            if (!response.connection) {
                return null
            }

            return normalizeConnection(response.connection)
        },

        async deleteConnection(connectionId: string): Promise<void> {
            const canvasId = requireActiveCanvas()

            await createWebSocketRequest<ConnectionDeletePayload, ConnectionDeletedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_DELETE,
                responseEvent: WebSocketResponseEvents.CONNECTION_DELETED,
                payload: {
                    canvasId,
                    connectionId
                }
            })
        },

        deleteConnectionsByPodId(podId: string): void {
            this.connections = this.connections.filter(
                conn => conn.sourcePodId !== podId && conn.targetPodId !== podId
            )

            if (this.selectedConnectionId) {
                const stillExists = this.connections.some(conn => conn.id === this.selectedConnectionId)
                if (!stillExists) {
                    this.selectedConnectionId = null
                }
            }
        },

        selectConnection(connectionId: string | null): void {
            this.selectedConnectionId = connectionId
        },

        startDragging(
            sourcePodId: string | undefined | null,
            sourceAnchor: AnchorPosition,
            startPoint: { x: number; y: number }
        ): void {
            this.draggingConnection = {
                sourcePodId: sourcePodId ?? undefined,
                sourceAnchor,
                startPoint,
                currentPoint: startPoint
            }
        },

        updateDraggingPosition(currentPoint: { x: number; y: number }): void {
            if (this.draggingConnection) {
                this.draggingConnection.currentPoint = currentPoint
            }
        },

        endDragging(): void {
            this.draggingConnection = null
        },

        updateConnectionStatusByTargetPod(targetPodId: string, status: ConnectionStatus): void {
            this.connections.forEach(conn => {
                if (conn.targetPodId === targetPodId) {
                    // ai-deciding 表示 AI 仍在判斷中，不應被強制設為 active（事件亂序保護）
                    if (conn.status === 'ai-deciding' && status === 'active') {
                        return
                    }
                    conn.status = status
                }
            })
        },

        updateAutoGroupStatus(targetPodId: string, status: ConnectionStatus): void {
            this.connections.forEach(conn => {
                if (conn.targetPodId === targetPodId &&
                    (conn.triggerMode === 'auto' || conn.triggerMode === 'ai-decide')) {
                    // ai-deciding 表示 AI 仍在判斷中，不應被強制設為 active（事件亂序保護）
                    if (conn.status === 'ai-deciding' && status === 'active') {
                        return
                    }
                    conn.status = status
                }
            })
        },

        async updateConnectionTriggerMode(connectionId: string, triggerMode: TriggerMode): Promise<Connection | null> {
            const canvasId = requireActiveCanvas()

            const response = await createWebSocketRequest<ConnectionUpdatePayload, ConnectionCreatedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_UPDATE,
                responseEvent: WebSocketResponseEvents.CONNECTION_UPDATED,
                payload: {
                    canvasId,
                    connectionId,
                    triggerMode
                }
            })

            if (!response.connection) {
                return null
            }

            return normalizeConnection(response.connection)
        },

        _getWorkflowHandlers() {
            return createWorkflowEventHandlers(this)
        },

        setupWorkflowListeners(): void {
            this.getWorkflowEventMap().forEach(([event, handler]) => {
                websocketClient.on(event, handler)
            })
        },

        cleanupWorkflowListeners(): void {
            this.getWorkflowEventMap().forEach(([event, handler]) => {
                websocketClient.off(event, handler)
            })
        },

        handleWorkflowAutoTriggered(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowAutoTriggered']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowAutoTriggered(payload)
        },

        handleWorkflowAiDecideTriggered(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowAiDecideTriggered']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowAiDecideTriggered(payload)
        },

        handleWorkflowComplete(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowComplete']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowComplete(payload)
        },

        handleWorkflowDirectTriggered(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowDirectTriggered']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowDirectTriggered(payload)
        },

        handleWorkflowDirectWaiting(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowDirectWaiting']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowDirectWaiting(payload)
        },

        handleWorkflowQueued(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowQueued']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowQueued(payload)
        },

        handleWorkflowQueueProcessed(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleWorkflowQueueProcessed']>[0]): void {
            this._getWorkflowHandlers().handleWorkflowQueueProcessed(payload)
        },

        handleAiDecidePending(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleAiDecidePending']>[0]): void {
            this._getWorkflowHandlers().handleAiDecidePending(payload)
        },

        handleAiDecideResult(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleAiDecideResult']>[0]): void {
            this._getWorkflowHandlers().handleAiDecideResult(payload)
        },

        handleAiDecideError(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleAiDecideError']>[0]): void {
            this._getWorkflowHandlers().handleAiDecideError(payload)
        },

        handleAiDecideClear(payload: Parameters<ReturnType<typeof createWorkflowEventHandlers>['handleAiDecideClear']>[0]): void {
            this._getWorkflowHandlers().handleAiDecideClear(payload)
        },

        clearAiDecideStatusByConnectionIds(connectionIds: string[]): void {
            this._getWorkflowHandlers().clearAiDecideStatusByConnectionIds(connectionIds)
        },

        addConnectionFromEvent(connection: Omit<Connection, 'createdAt' | 'status'> & { createdAt: string }): void {
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                triggerMode: connection.triggerMode ?? 'auto',
                status: 'idle' as ConnectionStatus
            }

            const exists = this.connections.some(conn => conn.id === enrichedConnection.id)
            if (!exists) {
                this.connections.push(enrichedConnection)
            }
        },

        updateConnectionFromEvent(connection: Omit<Connection, 'createdAt' | 'status'> & { createdAt: string }): void {
            const existingConnection = this.connections.find(conn => conn.id === connection.id)
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                triggerMode: connection.triggerMode ?? 'auto',
                status: existingConnection?.status ?? 'idle' as ConnectionStatus,
                decideReason: connection.decideReason ?? existingConnection?.decideReason
            }

            const index = this.connections.findIndex(conn => conn.id === enrichedConnection.id)
            if (index !== -1) {
                this.connections.splice(index, 1, enrichedConnection)
            }
        },

        removeConnectionFromEvent(connectionId: string): void {
            this.connections = this.connections.filter(connection => connection.id !== connectionId)
        },
    },
})
