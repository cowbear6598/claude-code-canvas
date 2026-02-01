import {defineStore} from 'pinia'
import type {Connection, DraggingConnection, AnchorPosition, ConnectionStatus} from '@/types/connection'
import {
    websocketClient,
    createWebSocketRequest,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
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
    },

    actions: {
        async loadConnectionsFromBackend(): Promise<void> {
            const response = await createWebSocketRequest<ConnectionListPayload, ConnectionListResultPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_LIST,
                responseEvent: WebSocketResponseEvents.CONNECTION_LIST_RESULT,
                payload: {}
            })

            if (response.connections) {
                this.connections = response.connections.map(conn => ({
                    ...conn,
                    createdAt: new Date(conn.createdAt),
                    autoTrigger: conn.autoTrigger ?? false,
                    status: 'inactive' as ConnectionStatus,
                }))
            }
        },

        async createConnection(
            sourcePodId: string,
            sourceAnchor: AnchorPosition,
            targetPodId: string,
            targetAnchor: AnchorPosition
        ): Promise<Connection | null> {
            if (sourcePodId === targetPodId) {
                console.warn('[ConnectionStore] Cannot connect pod to itself')
                return null
            }

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

            const response = await createWebSocketRequest<ConnectionCreatePayload, ConnectionCreatedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_CREATE,
                responseEvent: WebSocketResponseEvents.CONNECTION_CREATED,
                payload: {
                    sourcePodId,
                    sourceAnchor,
                    targetPodId,
                    targetAnchor,
                }
            })

            if (!response.connection) {
                return null
            }

            const connection: Connection = {
                ...response.connection,
                createdAt: new Date(response.connection.createdAt),
                autoTrigger: response.connection.autoTrigger ?? false,
                status: 'inactive' as ConnectionStatus,
            }
            this.connections.push(connection)

            return connection
        },

        async deleteConnection(connectionId: string): Promise<void> {
            await createWebSocketRequest<ConnectionDeletePayload, ConnectionDeletedPayload>({
                requestEvent: WebSocketRequestEvents.CONNECTION_DELETE,
                responseEvent: WebSocketResponseEvents.CONNECTION_DELETED,
                payload: {
                    connectionId
                }
            })

            this.connections = this.connections.filter(c => c.id !== connectionId)
            if (this.selectedConnectionId === connectionId) {
                this.selectedConnectionId = null
            }
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
            sourcePodId: string,
            sourceAnchor: AnchorPosition,
            startPoint: { x: number; y: number }
        ): void {
            this.draggingConnection = {
                sourcePodId,
                sourceAnchor,
                startPoint,
                currentPoint: startPoint,
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
    },
})
