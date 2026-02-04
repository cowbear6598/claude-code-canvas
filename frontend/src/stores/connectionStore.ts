import {defineStore} from 'pinia'
import type {Connection, DraggingConnection, AnchorPosition, ConnectionStatus} from '@/types/connection'
import {
    websocketClient,
    createWebSocketRequest,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
import {useCanvasStore} from '@/stores/canvasStore'
import type {
    ConnectionCreatedPayload,
    ConnectionListResultPayload,
    ConnectionDeletedPayload,
    WorkflowAutoTriggeredPayload,
    WorkflowCompletePayload,
    ConnectionListPayload,
    ConnectionCreatePayload,
    ConnectionDeletePayload
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
                    autoTrigger: conn.autoTrigger ?? false,
                    status: 'inactive' as ConnectionStatus
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

            const connection: Connection = {
                ...response.connection,
                createdAt: new Date(response.connection.createdAt),
                autoTrigger: response.connection.autoTrigger ?? false,
                status: 'inactive' as ConnectionStatus
            }

            return connection
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

        deleteConnectionsByIds(connectionIds: string[]): void {
            this.connections = this.connections.filter(
                conn => !connectionIds.includes(conn.id)
            )

            if (this.selectedConnectionId && connectionIds.includes(this.selectedConnectionId)) {
                this.selectedConnectionId = null
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

        setupWorkflowListeners(): void {
            websocketClient.on<WorkflowAutoTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, this.handleWorkflowAutoTriggered)
            websocketClient.on<WorkflowCompletePayload>(WebSocketResponseEvents.WORKFLOW_COMPLETE, this.handleWorkflowComplete)
        },

        cleanupWorkflowListeners(): void {
            websocketClient.off<WorkflowAutoTriggeredPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_TRIGGERED, this.handleWorkflowAutoTriggered)
            websocketClient.off<WorkflowCompletePayload>(WebSocketResponseEvents.WORKFLOW_COMPLETE, this.handleWorkflowComplete)
        },

        handleWorkflowAutoTriggered(payload: WorkflowAutoTriggeredPayload): void {
            this.updateConnectionStatusByTargetPod(payload.targetPodId, 'active')
        },

        handleWorkflowComplete(payload: WorkflowCompletePayload): void {
            this.updateConnectionStatusByTargetPod(payload.targetPodId, 'inactive')
        },

        addConnectionFromEvent(connection: any): void {
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                autoTrigger: connection.autoTrigger ?? false,
                status: 'inactive' as ConnectionStatus
            }

            const exists = this.connections.some(c => c.id === enrichedConnection.id)
            if (!exists) {
                this.connections.push(enrichedConnection)
            }
        },

        updateConnectionFromEvent(connection: any): void {
            const enrichedConnection: Connection = {
                ...connection,
                createdAt: new Date(connection.createdAt),
                autoTrigger: connection.autoTrigger ?? false,
                status: 'inactive' as ConnectionStatus
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
