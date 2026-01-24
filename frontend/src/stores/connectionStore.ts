import { defineStore } from 'pinia'
import type { Connection, DraggingConnection, AnchorPosition } from '@/types/connection'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type {
  ConnectionCreatedPayload,
  ConnectionListResultPayload,
  ConnectionDeletedPayload
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

    selectedConnection: (state): Connection | null => {
      if (!state.selectedConnectionId) return null
      return state.connections.find(c => c.id === state.selectedConnectionId) || null
    },
  },

  actions: {
    async loadConnectionsFromBackend(): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleConnectionListResult = (payload: ConnectionListResultPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offConnectionListResult(handleConnectionListResult)

            if (payload.success && payload.connections) {
              this.connections = payload.connections.map(conn => ({
                ...conn,
                createdAt: new Date(conn.createdAt),
              }))
              resolve()
            } else {
              console.error('[ConnectionStore] Connection list failed:', payload.error)
              reject(new Error(payload.error || 'Unknown error'))
            }
          }
        }

        websocketService.onConnectionListResult(handleConnectionListResult)
        websocketService.connectionList({ requestId })

        setTimeout(() => {
          websocketService.offConnectionListResult(handleConnectionListResult)
          reject(new Error('Connection list timeout'))
        }, 10000)
      })
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

      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleConnectionCreated = (payload: ConnectionCreatedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offConnectionCreated(handleConnectionCreated)

            if (payload.success && payload.connection) {
              const connection: Connection = {
                ...payload.connection,
                createdAt: new Date(payload.connection.createdAt),
              }
              this.connections.push(connection)
              resolve(connection)
            } else {
              console.error('[ConnectionStore] Connection creation failed:', payload.error)
              reject(new Error(payload.error || 'Unknown error'))
            }
          }
        }

        websocketService.onConnectionCreated(handleConnectionCreated)
        websocketService.connectionCreate({
          requestId,
          sourcePodId,
          sourceAnchor,
          targetPodId,
          targetAnchor,
        })

        setTimeout(() => {
          websocketService.offConnectionCreated(handleConnectionCreated)
          reject(new Error('Connection creation timeout'))
        }, 10000)
      })
    },

    async deleteConnection(connectionId: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleConnectionDeleted = (payload: ConnectionDeletedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offConnectionDeleted(handleConnectionDeleted)

            if (payload.success) {
              this.connections = this.connections.filter(c => c.id !== connectionId)
              if (this.selectedConnectionId === connectionId) {
                this.selectedConnectionId = null
              }
              resolve()
            } else {
              console.error('[ConnectionStore] Connection deletion failed:', payload.error)
              reject(new Error(payload.error || 'Unknown error'))
            }
          }
        }

        websocketService.onConnectionDeleted(handleConnectionDeleted)
        websocketService.connectionDelete({ requestId, connectionId })

        setTimeout(() => {
          websocketService.offConnectionDeleted(handleConnectionDeleted)
          reject(new Error('Connection deletion timeout'))
        }, 10000)
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
  },
})
