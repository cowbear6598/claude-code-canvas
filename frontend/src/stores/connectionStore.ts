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
                this.connections = response.connections.map(conn => ({
                    ...conn,
                    createdAt: new Date(conn.createdAt),
                    triggerMode: conn.triggerMode ?? 'auto',
                    status: this.mapDecideStatusToConnectionStatus(conn.decideStatus),
                    decideReason: conn.decideReason ?? undefined
                }))
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

            return {
                ...response.connection,
                createdAt: new Date(response.connection.createdAt),
                triggerMode: response.connection.triggerMode ?? 'auto',
                status: this.mapDecideStatusToConnectionStatus(response.connection.decideStatus),
                decideReason: response.connection.decideReason ?? undefined
            }
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
                    conn.status = status
                }
            })
        },

        updateAutoGroupStatus(targetPodId: string, status: ConnectionStatus): void {
            this.connections.forEach(conn => {
                if (conn.targetPodId === targetPodId &&
                    (conn.triggerMode === 'auto' || conn.triggerMode === 'ai-decide')) {
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

            return {
                ...response.connection,
                createdAt: new Date(response.connection.createdAt),
                triggerMode: response.connection.triggerMode ?? 'auto',
                status: this.mapDecideStatusToConnectionStatus(response.connection.decideStatus),
                decideReason: response.connection.decideReason ?? undefined
            }
        },

        setupWorkflowListeners(): void {
            websocketClient.on<WorkflowAutoTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, this.handleWorkflowAutoTriggered)
            websocketClient.on<WorkflowCompletePayload>(WebSocketResponseEvents.WORKFLOW_COMPLETE, this.handleWorkflowComplete)
            websocketClient.on<WorkflowAiDecidePendingPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_PENDING, this.handleAiDecidePending)
            websocketClient.on<WorkflowAiDecideResultPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_RESULT, this.handleAiDecideResult)
            websocketClient.on<WorkflowAiDecideErrorPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_ERROR, this.handleAiDecideError)
            websocketClient.on<WorkflowAiDecideClearPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_CLEAR, this.handleAiDecideClear)
            websocketClient.on<WorkflowAiDecideTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_TRIGGERED, this.handleWorkflowAiDecideTriggered)
            websocketClient.on<WorkflowDirectTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_DIRECT_TRIGGERED, this.handleWorkflowDirectTriggered)
            websocketClient.on<WorkflowDirectWaitingPayload>(WebSocketResponseEvents.WORKFLOW_DIRECT_WAITING, this.handleWorkflowDirectWaiting)
            websocketClient.on<WorkflowQueuedPayload>(WebSocketResponseEvents.WORKFLOW_QUEUED, this.handleWorkflowQueued)
            websocketClient.on<WorkflowQueueProcessedPayload>(WebSocketResponseEvents.WORKFLOW_QUEUE_PROCESSED, this.handleWorkflowQueueProcessed)
        },

        cleanupWorkflowListeners(): void {
            websocketClient.off<WorkflowAutoTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, this.handleWorkflowAutoTriggered)
            websocketClient.off<WorkflowCompletePayload>(WebSocketResponseEvents.WORKFLOW_COMPLETE, this.handleWorkflowComplete)
            websocketClient.off<WorkflowAiDecidePendingPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_PENDING, this.handleAiDecidePending)
            websocketClient.off<WorkflowAiDecideResultPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_RESULT, this.handleAiDecideResult)
            websocketClient.off<WorkflowAiDecideErrorPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_ERROR, this.handleAiDecideError)
            websocketClient.off<WorkflowAiDecideClearPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_CLEAR, this.handleAiDecideClear)
            websocketClient.off<WorkflowAiDecideTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AI_DECIDE_TRIGGERED, this.handleWorkflowAiDecideTriggered)
            websocketClient.off<WorkflowDirectTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_DIRECT_TRIGGERED, this.handleWorkflowDirectTriggered)
            websocketClient.off<WorkflowDirectWaitingPayload>(WebSocketResponseEvents.WORKFLOW_DIRECT_WAITING, this.handleWorkflowDirectWaiting)
            websocketClient.off<WorkflowQueuedPayload>(WebSocketResponseEvents.WORKFLOW_QUEUED, this.handleWorkflowQueued)
            websocketClient.off<WorkflowQueueProcessedPayload>(WebSocketResponseEvents.WORKFLOW_QUEUE_PROCESSED, this.handleWorkflowQueueProcessed)
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
                const connection = this.connections.find(c => c.id === payload.connectionId)
                if (connection) {
                    connection.status = 'idle'
                }
            }
        },

        handleWorkflowDirectTriggered(payload: WorkflowDirectTriggeredPayload): void {
            const connection = this.connections.find(c => c.id === payload.connectionId)
            if (connection) {
                connection.status = 'active'
            }
        },

        handleWorkflowDirectWaiting(payload: WorkflowDirectWaitingPayload): void {
            const connection = this.connections.find(c => c.id === payload.connectionId)
            if (connection) {
                connection.status = 'waiting'
            }
        },

        handleWorkflowQueued(payload: WorkflowQueuedPayload): void {
            if (payload.triggerMode === 'auto' || payload.triggerMode === 'ai-decide') {
                this.updateAutoGroupStatus(payload.targetPodId, 'queued')
            } else {
                const connection = this.connections.find(c => c.id === payload.connectionId)
                if (connection) {
                    connection.status = 'queued'
                }
            }
        },

        handleWorkflowQueueProcessed(payload: WorkflowQueueProcessedPayload): void {
            if (payload.triggerMode === 'auto' || payload.triggerMode === 'ai-decide') {
                this.updateAutoGroupStatus(payload.targetPodId, 'active')
            } else {
                const connection = this.connections.find(c => c.id === payload.connectionId)
                if (connection) {
                    connection.status = 'active'
                }
            }
        },

        handleAiDecidePending(payload: WorkflowAiDecidePendingPayload): void {
            payload.connectionIds.forEach(connectionId => {
                const connection = this.connections.find(c => c.id === connectionId)
                if (connection) {
                    connection.status = 'ai-deciding'
                    connection.decideReason = undefined
                }
            })
        },

        handleAiDecideResult(payload: WorkflowAiDecideResultPayload): void {
            const connection = this.connections.find(c => c.id === payload.connectionId)
            if (connection) {
                connection.status = payload.shouldTrigger ? 'ai-approved' : 'ai-rejected'
                connection.decideReason = payload.shouldTrigger ? undefined : payload.reason
            }
        },

        handleAiDecideError(payload: WorkflowAiDecideErrorPayload): void {
            const connection = this.connections.find(c => c.id === payload.connectionId)
            if (connection) {
                connection.status = 'ai-error'
                connection.decideReason = payload.error
            }
        },

        handleAiDecideClear(payload: WorkflowAiDecideClearPayload): void {
            payload.connectionIds.forEach(connectionId => {
                const connection = this.connections.find(c => c.id === connectionId)
                if (connection) {
                    connection.status = 'idle'
                    connection.decideReason = undefined
                }
            })
        },

        clearAiDecideStatusByConnectionIds(connectionIds: string[]): void {
            connectionIds.forEach(connectionId => {
                const connection = this.connections.find(c => c.id === connectionId)
                if (connection) {
                    connection.status = 'idle'
                    connection.decideReason = undefined
                }
            })
        },

        mapDecideStatusToConnectionStatus(decideStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'error'): ConnectionStatus {
            if (!decideStatus || decideStatus === 'none') return 'idle'
            if (decideStatus === 'pending') return 'ai-deciding'
            if (decideStatus === 'approved') return 'ai-approved'
            if (decideStatus === 'rejected') return 'ai-rejected'
            if (decideStatus === 'error') return 'ai-error'
            return 'idle'
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
