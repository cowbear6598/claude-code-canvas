import {defineStore} from 'pinia'
import type {AnchorPosition, Connection, ConnectionStatus, DraggingConnection, TriggerMode} from '@/types/connection'
import {
    createWebSocketRequest,
    websocketClient,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
import {useCanvasStore} from '@/stores/canvasStore'
import type {
    ConnectionCreatedPayload,
    ConnectionCreatePayload,
    ConnectionDeletedPayload,
    ConnectionDeletePayload,
    ConnectionListPayload,
    ConnectionListResultPayload,
    ConnectionUpdatePayload,
    WorkflowAutoTriggeredPayload,
    WorkflowCompletePayload,
    WorkflowAiDecidePendingPayload,
    WorkflowAiDecideResultPayload,
    WorkflowAiDecideErrorPayload,
    WorkflowAiDecideClearPayload,
    WorkflowAiDecideTriggeredPayload,
    WorkflowDirectTriggeredPayload,
    WorkflowDirectWaitingPayload,
    WorkflowQueuedPayload,
    WorkflowQueueProcessedPayload
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
            return state.connections.find(c => c.id === state.selectedConnectionId) || null
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
    },

    actions: {
        _findById(connectionId: string): Connection | undefined {
            return this.connections.find(c => c.id === connectionId)
        },

        _getWorkflowEventMap(): Array<[string, (payload: unknown) => void]> {
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
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                console.warn('[ConnectionStore] Cannot load connections: no active canvas')
                return
            }

            const response = await createWebSocketRequest<ConnectionListPayload, ConnectionListResultPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_LIST,
                responseEvent: WebSocketResponseEvents.CONNECTION_LIST_RESULT,
                payload: {
                    canvasId: canvasStore.activeCanvasId
                }
            })

            if (response.connections) {
                this.connections = response.connections.map(conn => normalizeConnection(conn))
            }
        },

        async createConnection(
            sourcePodId: string | undefined | null,
            sourceAnchor: AnchorPosition,
            targetPodId: string,
            targetAnchor: AnchorPosition
        ): Promise<Connection | null> {
            if (sourcePodId === targetPodId) {
                console.warn('[ConnectionStore] Cannot connect pod to itself')
                return null
            }

            if (sourcePodId) {
                const existingConnection = this.connections.find(
                    conn => conn.sourcePodId === sourcePodId && conn.targetPodId === targetPodId
                )
                if (existingConnection) {
                    const {toast} = useToast()
                    toast({
                        title: '連線已存在',
                        description: '這兩個 Pod 之間已經有連線了',
                        duration: 3000
                    })
                    return null
                }
            }

            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                throw new Error('無法建立連線：沒有啟用的畫布')
            }

            const payload: ConnectionCreatePayload = {
                requestId: '',
                canvasId: canvasStore.activeCanvasId,
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
            const canvasStore = useCanvasStore()

            await createWebSocketRequest<ConnectionDeletePayload, ConnectionDeletedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_DELETE,
                responseEvent: WebSocketResponseEvents.CONNECTION_DELETED,
                payload: {
                    canvasId: canvasStore.activeCanvasId!,
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
            const canvasStore = useCanvasStore()

            if (!canvasStore.activeCanvasId) {
                throw new Error('無法更新連線：沒有啟用的畫布')
            }

            const response = await createWebSocketRequest<ConnectionUpdatePayload, ConnectionCreatedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_UPDATE,
                responseEvent: WebSocketResponseEvents.CONNECTION_UPDATED,
                payload: {
                    canvasId: canvasStore.activeCanvasId,
                    connectionId,
                    triggerMode
                }
            })

            if (!response.connection) {
                return null
            }

            return normalizeConnection(response.connection)
        },

        setupWorkflowListeners(): void {
            this._getWorkflowEventMap().forEach(([event, handler]) => {
                websocketClient.on(event, handler)
            })
        },

        cleanupWorkflowListeners(): void {
            this._getWorkflowEventMap().forEach(([event, handler]) => {
                websocketClient.off(event, handler)
            })
        },

        handleWorkflowAutoTriggered(payload: WorkflowAutoTriggeredPayload): void {
            this.updateAutoGroupStatus(payload.targetPodId, 'active')
        },

        handleWorkflowAiDecideTriggered(payload: WorkflowAiDecideTriggeredPayload): void {
            this.updateAutoGroupStatus(payload.targetPodId, 'active')
        },

        handleWorkflowComplete(payload: WorkflowCompletePayload): void {
            const triggerMode = payload.triggerMode
            if (triggerMode === 'auto' || triggerMode === 'ai-decide') {
                this.updateAutoGroupStatus(payload.targetPodId, 'idle')
            } else {
                const connection = this._findById(payload.connectionId)
                if (connection) {
                    connection.status = 'idle'
                }
            }
        },

        handleWorkflowDirectTriggered(payload: WorkflowDirectTriggeredPayload): void {
            const connection = this._findById(payload.connectionId)
            if (connection) {
                connection.status = 'active'
            }
        },

        handleWorkflowDirectWaiting(payload: WorkflowDirectWaitingPayload): void {
            const connection = this._findById(payload.connectionId)
            if (connection) {
                connection.status = 'waiting'
            }
        },

        handleWorkflowQueued(payload: WorkflowQueuedPayload): void {
            if (payload.triggerMode === 'auto' || payload.triggerMode === 'ai-decide') {
                this.updateAutoGroupStatus(payload.targetPodId, 'queued')
            } else {
                const connection = this._findById(payload.connectionId)
                if (connection) {
                    connection.status = 'queued'
                }
            }
        },

        handleWorkflowQueueProcessed(payload: WorkflowQueueProcessedPayload): void {
            if (payload.triggerMode === 'auto' || payload.triggerMode === 'ai-decide') {
                this.updateAutoGroupStatus(payload.targetPodId, 'active')
            } else {
                const connection = this._findById(payload.connectionId)
                if (connection) {
                    connection.status = 'active'
                }
            }
        },

        handleAiDecidePending(payload: WorkflowAiDecidePendingPayload): void {
            payload.connectionIds.forEach(connectionId => {
                const connection = this._findById(connectionId)
                if (connection) {
                    connection.status = 'ai-deciding'
                    connection.decideReason = undefined
                }
            })
        },

        handleAiDecideResult(payload: WorkflowAiDecideResultPayload): void {
            const connection = this._findById(payload.connectionId)
            if (connection) {
                connection.status = payload.shouldTrigger ? 'ai-approved' : 'ai-rejected'
                connection.decideReason = payload.shouldTrigger ? undefined : payload.reason
            }
        },

        handleAiDecideError(payload: WorkflowAiDecideErrorPayload): void {
            const connection = this._findById(payload.connectionId)
            if (connection) {
                connection.status = 'ai-error'
                connection.decideReason = payload.error
            }
        },

        handleAiDecideClear(payload: WorkflowAiDecideClearPayload): void {
            this.clearAiDecideStatusByConnectionIds(payload.connectionIds)
        },

        clearAiDecideStatusByConnectionIds(connectionIds: string[]): void {
            connectionIds.forEach(connectionId => {
                const connection = this._findById(connectionId)
                if (connection) {
                    connection.status = 'idle'
                    connection.decideReason = undefined
                }
            })
        },

        addConnectionFromEvent(connection: Omit<Connection, 'createdAt' | 'status'> & { createdAt: string }): void {
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                triggerMode: connection.triggerMode ?? 'auto',
                status: 'idle' as ConnectionStatus
            }

            const exists = this.connections.some(c => c.id === enrichedConnection.id)
            if (!exists) {
                this.connections.push(enrichedConnection)
            }
        },

        updateConnectionFromEvent(connection: Omit<Connection, 'createdAt' | 'status'> & { createdAt: string }): void {
            const existingConnection = this.connections.find(c => c.id === connection.id)
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                triggerMode: connection.triggerMode ?? 'auto',
                status: existingConnection?.status ?? 'idle' as ConnectionStatus,
                decideReason: connection.decideReason ?? existingConnection?.decideReason
            }

            const index = this.connections.findIndex(c => c.id === enrichedConnection.id)
            if (index !== -1) {
                this.connections.splice(index, 1, enrichedConnection)
            }
        },

        removeConnectionFromEvent(connectionId: string): void {
            this.connections = this.connections.filter(c => c.id !== connectionId)
        },
    },
})
