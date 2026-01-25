import { defineStore } from 'pinia'
import type { Connection, DraggingConnection, AnchorPosition, WorkflowStatus } from '@/types/connection'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type {
  ConnectionCreatedPayload,
  ConnectionListResultPayload,
  ConnectionDeletedPayload,
  ConnectionUpdatedPayload,
  WorkflowTriggeredPayload,
  WorkflowCompletePayload,
  WorkflowErrorPayload,
  WorkflowAutoTriggeredPayload,
  WorkflowPendingPayload,
  WorkflowSourcesMergedPayload
} from '@/types/websocket'

interface ConnectionState {
  connections: Connection[]
  selectedConnectionId: string | null
  draggingConnection: DraggingConnection | null
  pendingTargets: Map<string, { completedCount: number; totalCount: number; pendingSourcePodIds: string[] }>
}

export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionState => ({
    connections: [],
    selectedConnectionId: null,
    draggingConnection: null,
    pendingTargets: new Map(),
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

    getPendingInfo: (state) => (targetPodId: string): { completedCount: number; totalCount: number; pendingSourcePodIds: string[] } | undefined => {
      return state.pendingTargets.get(targetPodId)
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
                autoTrigger: conn.autoTrigger ?? false,
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
                autoTrigger: payload.connection.autoTrigger ?? false,
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
              const connection = this.connections.find(c => c.id === connectionId)
              this.connections = this.connections.filter(c => c.id !== connectionId)
              if (this.selectedConnectionId === connectionId) {
                this.selectedConnectionId = null
              }

              if (connection) {
                const stillHasConnectionsToTarget = this.connections.some(
                  c => c.targetPodId === connection.targetPodId
                )
                if (!stillHasConnectionsToTarget) {
                  this.pendingTargets.delete(connection.targetPodId)
                }
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
      const affectedTargetPodIds = new Set<string>()

      this.connections.forEach(conn => {
        if (conn.sourcePodId === podId || conn.targetPodId === podId) {
          affectedTargetPodIds.add(conn.targetPodId)
        }
      })

      this.connections = this.connections.filter(
        conn => conn.sourcePodId !== podId && conn.targetPodId !== podId
      )

      affectedTargetPodIds.forEach(targetPodId => {
        const stillHasConnectionsToTarget = this.connections.some(
          c => c.targetPodId === targetPodId
        )
        if (!stillHasConnectionsToTarget) {
          this.pendingTargets.delete(targetPodId)
        }
      })

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

    async triggerWorkflow(connectionId: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const connection = this.connections.find(c => c.id === connectionId)

        if (!connection) {
          reject(new Error('Connection not found'))
          return
        }

        this.updateConnectionWorkflowStatus(connectionId, 'transferring')

        const handleWorkflowTriggered = (payload: WorkflowTriggeredPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offWorkflowTriggered(handleWorkflowTriggered)
            clearTimeout(timeoutId)

            if (payload.success) {
              resolve()
            } else {
              this.updateConnectionWorkflowStatus(connectionId, 'error')
              setTimeout(() => {
                this.updateConnectionWorkflowStatus(connectionId, 'idle')
              }, 3000)
              reject(new Error(payload.error || 'Unknown error'))
            }
          }
        }

        const timeoutId = setTimeout(() => {
          websocketService.offWorkflowTriggered(handleWorkflowTriggered)
          this.updateConnectionWorkflowStatus(connectionId, 'error')
          setTimeout(() => {
            this.updateConnectionWorkflowStatus(connectionId, 'idle')
          }, 3000)
          reject(new Error('Workflow trigger timeout'))
        }, 10000)

        websocketService.onWorkflowTriggered(handleWorkflowTriggered)
        websocketService.workflowTrigger({ requestId, connectionId })
      })
    },

    updateConnectionWorkflowStatus(connectionId: string, status: WorkflowStatus): void {
      const connection = this.connections.find(c => c.id === connectionId)
      if (connection) {
        connection.workflowStatus = status
      }
    },

    updateConnection(connectionId: string, updates: Partial<Connection>): void {
      const connection = this.connections.find(c => c.id === connectionId)
      if (connection) {
        Object.assign(connection, updates)
      }
    },

    updatePendingTarget(
      targetPodId: string,
      info: { completedCount: number; totalCount: number; pendingSourcePodIds: string[] }
    ): void {
      this.pendingTargets.set(targetPodId, info)

      const connections = this.getConnectionsByTargetPodId(targetPodId)
      connections.forEach(connection => {
        connection.workflowStatus = 'waiting'
        connection.pendingInfo = {
          completedCount: info.completedCount,
          totalCount: info.totalCount,
        }
      })
    },

    clearPendingTarget(targetPodId: string): void {
      this.pendingTargets.delete(targetPodId)

      const connections = this.getConnectionsByTargetPodId(targetPodId)
      connections.forEach(connection => {
        connection.pendingInfo = undefined
      })
    },

    async updateConnectionAutoTrigger(connectionId: string, autoTrigger: boolean): Promise<void> {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()

        const handleConnectionUpdated = (payload: ConnectionUpdatedPayload) => {
          if (payload.requestId === requestId) {
            websocketService.offConnectionUpdated(handleConnectionUpdated)
            clearTimeout(timeoutId)

            if (payload.success && payload.connection) {
              this.updateConnection(connectionId, { autoTrigger: payload.connection.autoTrigger ?? false })
              resolve()
            } else {
              console.error('[ConnectionStore] Connection update failed:', payload.error)
              reject(new Error(payload.error || 'Unknown error'))
            }
          }
        }

        const timeoutId = setTimeout(() => {
          websocketService.offConnectionUpdated(handleConnectionUpdated)
          reject(new Error('Connection update timeout'))
        }, 10000)

        websocketService.onConnectionUpdated(handleConnectionUpdated)
        websocketService.connectionUpdate({ requestId, connectionId, autoTrigger })
      })
    },

    setupWorkflowListeners(): void {
      websocketService.onWorkflowTriggered((payload: WorkflowTriggeredPayload) => {
        if (payload.success) {
          this.updateConnectionWorkflowStatus(payload.connectionId, 'processing')
        }
      })

      websocketService.onWorkflowAutoTriggered((payload: WorkflowAutoTriggeredPayload) => {
        console.log('[ConnectionStore] Workflow auto-triggered:', payload.connectionId)
        this.updateConnectionWorkflowStatus(payload.connectionId, 'transferring')
      })

      websocketService.onWorkflowComplete((payload: WorkflowCompletePayload) => {
        if (payload.success) {
          this.updateConnectionWorkflowStatus(payload.connectionId, 'completed')
          setTimeout(() => {
            this.updateConnectionWorkflowStatus(payload.connectionId, 'idle')
          }, 3000)
        } else {
          this.updateConnectionWorkflowStatus(payload.connectionId, 'error')
          console.error('[ConnectionStore] Workflow complete error:', payload.error)
          setTimeout(() => {
            this.updateConnectionWorkflowStatus(payload.connectionId, 'idle')
          }, 3000)
        }
      })

      websocketService.onWorkflowError((payload: WorkflowErrorPayload) => {
        this.updateConnectionWorkflowStatus(payload.connectionId, 'error')

        const errorMessages: Record<string, string> = {
          VALIDATION_ERROR: '請求格式錯誤',
          CONNECTION_NOT_FOUND: '連線不存在，請重新整理頁面',
          SOURCE_POD_NOT_FOUND: '來源 POD 不存在',
          TARGET_POD_NOT_FOUND: '目標 POD 不存在',
          TARGET_POD_BUSY: '目標 POD 正在處理中，請稍後再試',
          NO_SOURCE_CONTENT: '來源 POD 沒有可傳遞的內容',
          INTERNAL_ERROR: '系統錯誤，請稍後再試',
        }

        const message = errorMessages[payload.code] || payload.error
        console.error('[ConnectionStore] Workflow error:', message, payload)

        setTimeout(() => {
          this.updateConnectionWorkflowStatus(payload.connectionId, 'idle')
        }, 3000)
      })

      websocketService.onWorkflowPending((payload: WorkflowPendingPayload) => {
        console.log('[ConnectionStore] Workflow pending:', payload)
        this.updatePendingTarget(payload.targetPodId, {
          completedCount: payload.completedCount,
          totalCount: payload.totalSources,
          pendingSourcePodIds: payload.pendingSourcePodIds,
        })
      })

      websocketService.onWorkflowSourcesMerged((payload: WorkflowSourcesMergedPayload) => {
        console.log('[ConnectionStore] Workflow sources merged:', payload)
        this.clearPendingTarget(payload.targetPodId)

        const connections = this.getConnectionsByTargetPodId(payload.targetPodId)
        connections.forEach(connection => {
          connection.workflowStatus = 'transferring'
        })
      })
    },
  },
})
