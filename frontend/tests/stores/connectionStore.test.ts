import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { mockWebSocketModule, mockCreateWebSocketRequest, resetMockWebSocket } from '../helpers/mockWebSocket'
import { createMockCanvas, createMockConnection } from '../helpers/factories'
import { useConnectionStore } from '@/stores/connectionStore'
import { useCanvasStore } from '@/stores/canvasStore'
import type { Connection, TriggerMode, ConnectionStatus } from '@/types/connection'
import type {
  WorkflowAutoTriggeredPayload,
  WorkflowCompletePayload,
  WorkflowAiDecidePendingPayload,
  WorkflowAiDecideResultPayload,
  WorkflowAiDecideErrorPayload,
  WorkflowAiDecideClearPayload,
  WorkflowDirectTriggeredPayload,
  WorkflowDirectWaitingPayload,
  WorkflowQueuedPayload,
  WorkflowQueueProcessedPayload,
} from '@/types/websocket'

// Mock WebSocket
vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

describe('connectionStore', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()
  })

  describe('初始狀態', () => {
    it('connections 應為空陣列', () => {
      const store = useConnectionStore()

      expect(store.connections).toEqual([])
    })

    it('selectedConnectionId 應為 null', () => {
      const store = useConnectionStore()

      expect(store.selectedConnectionId).toBeNull()
    })

    it('draggingConnection 應為 null', () => {
      const store = useConnectionStore()

      expect(store.draggingConnection).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getConnectionsByPodId', () => {
      it('應回傳包含該 Pod 的所有 Connection（source 或 target）', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-b', targetPodId: 'pod-c' })
        const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-c', targetPodId: 'pod-d' })
        store.connections = [conn1, conn2, conn3]

        const result = store.getConnectionsByPodId('pod-b')

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn1)
        expect(result).toContainEqual(conn2)
      })

      it('Pod 不在任何 Connection 中時應回傳空陣列', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        store.connections = [conn]

        const result = store.getConnectionsByPodId('pod-z')

        expect(result).toEqual([])
      })
    })

    describe('getOutgoingConnections', () => {
      it('應僅回傳 sourcePodId 匹配的 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-a', targetPodId: 'pod-c' })
        const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-b', targetPodId: 'pod-a' })
        store.connections = [conn1, conn2, conn3]

        const result = store.getOutgoingConnections('pod-a')

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn1)
        expect(result).toContainEqual(conn2)
      })
    })

    describe('getConnectionsByTargetPodId', () => {
      it('應僅回傳 targetPodId 匹配的 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-c' })
        const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-b', targetPodId: 'pod-c' })
        const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-c', targetPodId: 'pod-d' })
        store.connections = [conn1, conn2, conn3]

        const result = store.getConnectionsByTargetPodId('pod-c')

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn1)
        expect(result).toContainEqual(conn2)
      })
    })

    describe('selectedConnection', () => {
      it('有 selectedConnectionId 時應回傳對應 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1' })
        const conn2 = createMockConnection({ id: 'conn-2' })
        store.connections = [conn1, conn2]
        store.selectedConnectionId = 'conn-2'

        const result = store.selectedConnection

        expect(result).toEqual(conn2)
      })

      it('無 selectedConnectionId 時應回傳 null', () => {
        const store = useConnectionStore()
        const conn = createMockConnection()
        store.connections = [conn]
        store.selectedConnectionId = null

        const result = store.selectedConnection

        expect(result).toBeNull()
      })

      it('selectedConnectionId 不存在於 connections 中時應回傳 null', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ id: 'conn-1' })
        store.connections = [conn]
        store.selectedConnectionId = 'non-existent'

        const result = store.selectedConnection

        expect(result).toBeNull()
      })
    })

    describe('isSourcePod', () => {
      it('無 incoming Connection 時應為 true', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        store.connections = [conn]

        const result = store.isSourcePod('pod-a')

        expect(result).toBe(true)
      })

      it('有 incoming Connection 時應為 false', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        store.connections = [conn]

        const result = store.isSourcePod('pod-b')

        expect(result).toBe(false)
      })
    })

    describe('hasUpstreamConnections', () => {
      it('有 incoming Connection 時應為 true', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        store.connections = [conn]

        const result = store.hasUpstreamConnections('pod-b')

        expect(result).toBe(true)
      })

      it('無 incoming Connection 時應為 false', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
        store.connections = [conn]

        const result = store.hasUpstreamConnections('pod-a')

        expect(result).toBe(false)
      })
    })

    describe('getAiDecideConnections', () => {
      it('應僅回傳 triggerMode 為 ai-decide 的 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', triggerMode: 'auto' })
        const conn2 = createMockConnection({ id: 'conn-2', triggerMode: 'ai-decide' })
        const conn3 = createMockConnection({ id: 'conn-3', triggerMode: 'direct' })
        const conn4 = createMockConnection({ id: 'conn-4', triggerMode: 'ai-decide' })
        store.connections = [conn1, conn2, conn3, conn4]

        const result = store.getAiDecideConnections

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn2)
        expect(result).toContainEqual(conn4)
      })
    })

    describe('getDirectConnections', () => {
      it('應僅回傳 triggerMode 為 direct 的 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', triggerMode: 'auto' })
        const conn2 = createMockConnection({ id: 'conn-2', triggerMode: 'direct' })
        const conn3 = createMockConnection({ id: 'conn-3', triggerMode: 'ai-decide' })
        const conn4 = createMockConnection({ id: 'conn-4', triggerMode: 'direct' })
        store.connections = [conn1, conn2, conn3, conn4]

        const result = store.getDirectConnections

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn2)
        expect(result).toContainEqual(conn4)
      })
    })

    describe('getAiDecideConnectionsBySourcePodId', () => {
      it('應篩選 sourcePodId + ai-decide', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', triggerMode: 'ai-decide' })
        const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-a', triggerMode: 'auto' })
        const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-b', triggerMode: 'ai-decide' })
        const conn4 = createMockConnection({ id: 'conn-4', sourcePodId: 'pod-a', triggerMode: 'ai-decide' })
        store.connections = [conn1, conn2, conn3, conn4]

        const result = store.getAiDecideConnectionsBySourcePodId('pod-a')

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn1)
        expect(result).toContainEqual(conn4)
      })
    })

    describe('getDirectConnectionsBySourcePodId', () => {
      it('應篩選 sourcePodId + direct', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', triggerMode: 'direct' })
        const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-a', triggerMode: 'auto' })
        const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-b', triggerMode: 'direct' })
        const conn4 = createMockConnection({ id: 'conn-4', sourcePodId: 'pod-a', triggerMode: 'direct' })
        store.connections = [conn1, conn2, conn3, conn4]

        const result = store.getDirectConnectionsBySourcePodId('pod-a')

        expect(result).toHaveLength(2)
        expect(result).toContainEqual(conn1)
        expect(result).toContainEqual(conn4)
      })
    })
  })

  describe('createConnection', () => {
    it('成功時應回傳 Connection、預設 triggerMode 為 auto', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      const newConnection = createMockConnection({
        id: 'new-conn',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        triggerMode: 'auto',
      })

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          ...newConnection,
          createdAt: newConnection.createdAt.toISOString(),
        },
      })

      const result = await store.createConnection('pod-a', 'bottom', 'pod-b', 'top')

      expect(result).toEqual(newConnection)
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'connection:create',
        responseEvent: 'connection:created',
        payload: {
          requestId: '',
          canvasId: 'canvas-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
        },
      })
    })

    it('自我連接時應回傳 null', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      const result = await store.createConnection('pod-a', 'bottom', 'pod-a', 'top')

      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith('[ConnectionStore] Cannot connect pod to itself')
      expect(mockCreateWebSocketRequest).not.toHaveBeenCalled()
    })

    it('重複連接時應回傳 null 並顯示 Toast', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      const existingConn = createMockConnection({ sourcePodId: 'pod-a', targetPodId: 'pod-b' })
      store.connections = [existingConn]

      const result = await store.createConnection('pod-a', 'bottom', 'pod-b', 'top')

      expect(result).toBeNull()
      expect(mockToast).toHaveBeenCalledWith({
        title: '連線已存在',
        description: '這兩個 Pod 之間已經有連線了',
        duration: 3000,
      })
      expect(mockCreateWebSocketRequest).not.toHaveBeenCalled()
    })

    it('無 activeCanvasId 時應 throw', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const store = useConnectionStore()

      await expect(store.createConnection('pod-a', 'bottom', 'pod-b', 'top')).rejects.toThrow(
        '沒有啟用的畫布'
      )
    })

    it('WebSocket 回應無 connection 時應回傳 null', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({})

      const result = await store.createConnection('pod-a', 'bottom', 'pod-b', 'top')

      expect(result).toBeNull()
    })

    it('後端回傳 connectionStatus 時應直接使用', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          id: 'conn-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          createdAt: new Date().toISOString(),
          triggerMode: 'ai-decide',
          connectionStatus: 'ai-approved',
        },
      })

      const result = await store.createConnection('pod-a', 'bottom', 'pod-b', 'top')

      expect(result?.status).toBe('ai-approved')
    })

    it('後端未回傳 connectionStatus 時應 fallback 為 idle', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          id: 'conn-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          createdAt: new Date().toISOString(),
        },
      })

      const result = await store.createConnection('pod-a', 'bottom', 'pod-b', 'top')

      expect(result?.status).toBe('idle')
    })

    it('sourcePodId 為 null 時不應設定在 payload 中', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          id: 'conn-1',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          sourceAnchor: 'bottom',
          createdAt: new Date().toISOString(),
        },
      })

      await store.createConnection(null, 'bottom', 'pod-b', 'top')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'connection:create',
        responseEvent: 'connection:created',
        payload: {
          requestId: '',
          canvasId: 'canvas-1',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          // 注意：sourcePodId 不存在
        },
      })
    })
  })

  describe('deleteConnection', () => {
    it('應發送 WebSocket 刪除請求', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({ success: true })

      await store.deleteConnection('conn-1')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'connection:delete',
        responseEvent: 'connection:deleted',
        payload: {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
        },
      })
    })
  })

  describe('deleteConnectionsByPodId', () => {
    it('應移除所有含該 podId 的 Connection', () => {
      const store = useConnectionStore()
      const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-b' })
      const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-b', targetPodId: 'pod-c' })
      const conn3 = createMockConnection({ id: 'conn-3', sourcePodId: 'pod-c', targetPodId: 'pod-d' })
      store.connections = [conn1, conn2, conn3]

      store.deleteConnectionsByPodId('pod-b')

      expect(store.connections).toHaveLength(1)
      expect(store.connections).toContainEqual(conn3)
    })

    it('刪除包含 selectedConnectionId 的 Connection 時應清除選取', () => {
      const store = useConnectionStore()
      const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-b' })
      const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-c', targetPodId: 'pod-d' })
      store.connections = [conn1, conn2]
      store.selectedConnectionId = 'conn-1'

      store.deleteConnectionsByPodId('pod-a')

      expect(store.selectedConnectionId).toBeNull()
    })

    it('未刪除 selectedConnection 時應保留選取', () => {
      const store = useConnectionStore()
      const conn1 = createMockConnection({ id: 'conn-1', sourcePodId: 'pod-a', targetPodId: 'pod-b' })
      const conn2 = createMockConnection({ id: 'conn-2', sourcePodId: 'pod-c', targetPodId: 'pod-d' })
      store.connections = [conn1, conn2]
      store.selectedConnectionId = 'conn-2'

      store.deleteConnectionsByPodId('pod-a')

      expect(store.selectedConnectionId).toBe('conn-2')
    })
  })

  describe('updateConnectionTriggerMode', () => {
    it('成功時應回傳更新後的 Connection', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      const updatedConnection = createMockConnection({
        id: 'conn-1',
        triggerMode: 'ai-decide',
      })

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          ...updatedConnection,
          createdAt: updatedConnection.createdAt.toISOString(),
        },
      })

      const result = await store.updateConnectionTriggerMode('conn-1', 'ai-decide')

      expect(result).toEqual(updatedConnection)
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'connection:update',
        responseEvent: 'connection:updated',
        payload: {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          triggerMode: 'ai-decide',
        },
      })
    })

    it('無 activeCanvasId 時應 throw', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const store = useConnectionStore()

      await expect(store.updateConnectionTriggerMode('conn-1', 'direct')).rejects.toThrow(
        '沒有啟用的畫布'
      )
    })

    it('WebSocket 回應無 connection 時應回傳 null', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({})

      const result = await store.updateConnectionTriggerMode('conn-1', 'direct')

      expect(result).toBeNull()
    })

    it('後端回傳 connectionStatus 時應直接使用', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          id: 'conn-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          createdAt: new Date().toISOString(),
          triggerMode: 'ai-decide',
          connectionStatus: 'ai-rejected',
          decideReason: '不符合條件',
        },
      })

      const result = await store.updateConnectionTriggerMode('conn-1', 'ai-decide')

      expect(result?.status).toBe('ai-rejected')
    })

    it('後端未回傳 connectionStatus 時應 fallback 為 idle', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          id: 'conn-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          targetPodId: 'pod-b',
          targetAnchor: 'top',
          createdAt: new Date().toISOString(),
          triggerMode: 'direct',
        },
      })

      const result = await store.updateConnectionTriggerMode('conn-1', 'direct')

      expect(result?.status).toBe('idle')
    })
  })

  describe('拖曳連線', () => {
    describe('startDragging', () => {
      it('應設定 draggingConnection', () => {
        const store = useConnectionStore()

        store.startDragging('pod-a', 'bottom', { x: 100, y: 200 })

        expect(store.draggingConnection).toEqual({
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          startPoint: { x: 100, y: 200 },
          currentPoint: { x: 100, y: 200 },
        })
      })

      it('sourcePodId 為 null 時應設為 undefined', () => {
        const store = useConnectionStore()

        store.startDragging(null, 'top', { x: 50, y: 50 })

        expect(store.draggingConnection).toEqual({
          sourcePodId: undefined,
          sourceAnchor: 'top',
          startPoint: { x: 50, y: 50 },
          currentPoint: { x: 50, y: 50 },
        })
      })
    })

    describe('updateDraggingPosition', () => {
      it('應更新 currentPoint', () => {
        const store = useConnectionStore()
        store.draggingConnection = {
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          startPoint: { x: 100, y: 200 },
          currentPoint: { x: 100, y: 200 },
        }

        store.updateDraggingPosition({ x: 150, y: 250 })

        expect(store.draggingConnection.currentPoint).toEqual({ x: 150, y: 250 })
      })

      it('draggingConnection 為 null 時不應報錯', () => {
        const store = useConnectionStore()
        store.draggingConnection = null

        expect(() => store.updateDraggingPosition({ x: 150, y: 250 })).not.toThrow()
      })
    })

    describe('endDragging', () => {
      it('應清除 draggingConnection', () => {
        const store = useConnectionStore()
        store.draggingConnection = {
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom',
          startPoint: { x: 100, y: 200 },
          currentPoint: { x: 150, y: 250 },
        }

        store.endDragging()

        expect(store.draggingConnection).toBeNull()
      })
    })
  })

  describe('工作流處理', () => {
    describe('handleWorkflowAutoTriggered', () => {
      it('auto/ai-decide Connection 應設為 active', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'auto', status: 'idle' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'idle' })
        const conn3 = createMockConnection({ id: 'conn-3', targetPodId: 'pod-target', triggerMode: 'direct', status: 'idle' })
        store.connections = [conn1, conn2, conn3]

        const payload: WorkflowAutoTriggeredPayload = {
          connectionId: 'conn-1',
          sourcePodId: 'pod-source',
          targetPodId: 'pod-target',
          transferredContent: 'test',
          isSummarized: false,
        }

        store.handleWorkflowAutoTriggered(payload)

        expect(conn1.status).toBe('active')
        expect(conn2.status).toBe('active')
        expect(conn3.status).toBe('idle') // direct 不受影響
      })

      it('應將 ai-approved 的 Connection 更新為 active', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'ai-approved' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'auto', status: 'idle' })
        store.connections = [conn1, conn2]

        const payload: WorkflowAutoTriggeredPayload = {
          connectionId: 'conn-1',
          sourcePodId: 'pod-source',
          targetPodId: 'pod-target',
          transferredContent: 'test',
          isSummarized: false,
        }

        store.handleWorkflowAutoTriggered(payload)

        expect(conn1.status).toBe('active')
        expect(conn2.status).toBe('active')
      })
    })

    describe('handleWorkflowComplete', () => {
      it('auto/ai-decide triggerMode 時所有 Connection 應回 idle', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'auto', status: 'active' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'active' })
        store.connections = [conn1, conn2]

        const payload: WorkflowCompletePayload = {
          requestId: 'req-1',
          connectionId: 'conn-1',
          targetPodId: 'pod-target',
          success: true,
          triggerMode: 'auto',
        }

        store.handleWorkflowComplete(payload)

        expect(conn1.status).toBe('idle')
        expect(conn2.status).toBe('idle')
      })

      it('direct triggerMode 時僅指定 connectionId 應回 idle', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'direct', status: 'active' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'direct', status: 'active' })
        store.connections = [conn1, conn2]

        const payload: WorkflowCompletePayload = {
          requestId: 'req-1',
          connectionId: 'conn-1',
          targetPodId: 'pod-target',
          success: true,
          triggerMode: 'direct',
        }

        store.handleWorkflowComplete(payload)

        expect(conn1.status).toBe('idle')
        expect(conn2.status).toBe('active') // 不變
      })
    })

    describe('handleWorkflowDirectTriggered', () => {
      it('指定 connectionId 應設為 active', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'idle' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'idle' })
        store.connections = [conn1, conn2]

        const payload: WorkflowDirectTriggeredPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          transferredContent: 'test',
          isSummarized: false,
        }

        store.handleWorkflowDirectTriggered(payload)

        expect(conn1.status).toBe('active')
        expect(conn2.status).toBe('idle')
      })
    })

    describe('handleWorkflowDirectWaiting', () => {
      it('指定 connectionId 應設為 waiting', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'idle' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'idle' })
        store.connections = [conn1, conn2]

        const payload: WorkflowDirectWaitingPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
        }

        store.handleWorkflowDirectWaiting(payload)

        expect(conn1.status).toBe('waiting')
        expect(conn2.status).toBe('idle')
      })
    })

    describe('handleAiDecidePending', () => {
      it('批量 connectionIds 應設為 ai-deciding、清除 decideReason', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'idle', decideReason: 'old reason' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'idle', decideReason: 'old reason' })
        const conn3 = createMockConnection({ id: 'conn-3', status: 'idle' })
        store.connections = [conn1, conn2, conn3]

        const payload: WorkflowAiDecidePendingPayload = {
          canvasId: 'canvas-1',
          connectionIds: ['conn-1', 'conn-2'],
          sourcePodId: 'pod-a',
        }

        store.handleAiDecidePending(payload)

        expect(conn1.status).toBe('ai-deciding')
        expect(conn1.decideReason).toBeUndefined()
        expect(conn2.status).toBe('ai-deciding')
        expect(conn2.decideReason).toBeUndefined()
        expect(conn3.status).toBe('idle')
      })
    })

    describe('handleAiDecideResult', () => {
      it('shouldTrigger true 時應設為 ai-approved、清除 decideReason', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ id: 'conn-1', status: 'ai-deciding' })
        store.connections = [conn]

        const payload: WorkflowAiDecideResultPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          shouldTrigger: true,
          reason: 'approved',
        }

        store.handleAiDecideResult(payload)

        expect(conn.status).toBe('ai-approved')
        expect(conn.decideReason).toBeUndefined()
      })

      it('shouldTrigger false 時應設為 ai-rejected + decideReason', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ id: 'conn-1', status: 'ai-deciding' })
        store.connections = [conn]

        const payload: WorkflowAiDecideResultPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          shouldTrigger: false,
          reason: 'not relevant',
        }

        store.handleAiDecideResult(payload)

        expect(conn.status).toBe('ai-rejected')
        expect(conn.decideReason).toBe('not relevant')
      })
    })

    describe('handleAiDecideError', () => {
      it('應設為 ai-error + decideReason', () => {
        const store = useConnectionStore()
        const conn = createMockConnection({ id: 'conn-1', status: 'ai-deciding' })
        store.connections = [conn]

        const payload: WorkflowAiDecideErrorPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          error: 'AI service error',
        }

        store.handleAiDecideError(payload)

        expect(conn.status).toBe('ai-error')
        expect(conn.decideReason).toBe('AI service error')
      })
    })

    describe('handleAiDecideClear', () => {
      it('批量設為 idle + 清除 decideReason', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'ai-rejected', decideReason: 'rejected reason' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'ai-approved' })
        const conn3 = createMockConnection({ id: 'conn-3', status: 'ai-error', decideReason: 'error reason' })
        store.connections = [conn1, conn2, conn3]

        const payload: WorkflowAiDecideClearPayload = {
          canvasId: 'canvas-1',
          connectionIds: ['conn-1', 'conn-2'],
        }

        store.handleAiDecideClear(payload)

        expect(conn1.status).toBe('idle')
        expect(conn1.decideReason).toBeUndefined()
        expect(conn2.status).toBe('idle')
        expect(conn2.decideReason).toBeUndefined()
        expect(conn3.status).toBe('ai-error') // 不變
      })
    })

    describe('handleWorkflowQueued', () => {
      it('auto/ai-decide triggerMode 時應設為 queued', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'auto', status: 'idle' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'idle' })
        const conn3 = createMockConnection({ id: 'conn-3', targetPodId: 'pod-target', triggerMode: 'direct', status: 'idle' })
        store.connections = [conn1, conn2, conn3]

        const payload: WorkflowQueuedPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-source',
          targetPodId: 'pod-target',
          position: 1,
          queueSize: 2,
          triggerMode: 'auto',
        }

        store.handleWorkflowQueued(payload)

        expect(conn1.status).toBe('queued')
        expect(conn2.status).toBe('queued')
        expect(conn3.status).toBe('idle')
      })

      it('direct triggerMode 時僅指定 connectionId 應設為 queued', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'idle' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'idle' })
        store.connections = [conn1, conn2]

        const payload: WorkflowQueuedPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          position: 1,
          queueSize: 1,
          triggerMode: 'direct',
        }

        store.handleWorkflowQueued(payload)

        expect(conn1.status).toBe('queued')
        expect(conn2.status).toBe('idle')
      })
    })

    describe('handleWorkflowQueueProcessed', () => {
      it('auto/ai-decide triggerMode 時應設為 active', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'auto', status: 'queued' })
        const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'queued' })
        store.connections = [conn1, conn2]

        const payload: WorkflowQueueProcessedPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-source',
          targetPodId: 'pod-target',
          remainingQueueSize: 0,
          triggerMode: 'auto',
        }

        store.handleWorkflowQueueProcessed(payload)

        expect(conn1.status).toBe('active')
        expect(conn2.status).toBe('active')
      })

      it('direct triggerMode 時僅指定 connectionId 應設為 active', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1', status: 'queued' })
        const conn2 = createMockConnection({ id: 'conn-2', status: 'queued' })
        store.connections = [conn1, conn2]

        const payload: WorkflowQueueProcessedPayload = {
          canvasId: 'canvas-1',
          connectionId: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          remainingQueueSize: 0,
          triggerMode: 'direct',
        }

        store.handleWorkflowQueueProcessed(payload)

        expect(conn1.status).toBe('active')
        expect(conn2.status).toBe('queued')
      })
    })
  })

  describe('updateConnectionStatusByTargetPod', () => {
    it('應更新所有 targetPodId 匹配的 Connection 狀態', () => {
      const store = useConnectionStore()
      const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', status: 'idle' })
      const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', status: 'idle' })
      const conn3 = createMockConnection({ id: 'conn-3', targetPodId: 'pod-other', status: 'idle' })
      store.connections = [conn1, conn2, conn3]

      store.updateConnectionStatusByTargetPod('pod-target', 'active')

      expect(conn1.status).toBe('active')
      expect(conn2.status).toBe('active')
      expect(conn3.status).toBe('idle')
    })

    it('應將 ai-approved 的 Connection 更新為 active', () => {
      const store = useConnectionStore()
      const conn1 = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'ai-approved' })
      const conn2 = createMockConnection({ id: 'conn-2', targetPodId: 'pod-target', triggerMode: 'auto', status: 'idle' })
      store.connections = [conn1, conn2]

      store.updateConnectionStatusByTargetPod('pod-target', 'active')

      expect(conn1.status).toBe('active')
      expect(conn2.status).toBe('active')
    })

    it('queued -> active 應允許覆蓋', () => {
      const store = useConnectionStore()
      const conn = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', status: 'queued' })
      store.connections = [conn]

      store.updateConnectionStatusByTargetPod('pod-target', 'active')

      expect(conn.status).toBe('active')
    })

    it('ai-decide + ai-approved 設為 idle 時應允許更新', () => {
      const store = useConnectionStore()
      const conn = createMockConnection({ id: 'conn-1', targetPodId: 'pod-target', triggerMode: 'ai-decide', status: 'ai-approved' })
      store.connections = [conn]

      store.updateConnectionStatusByTargetPod('pod-target', 'idle')

      expect(conn.status).toBe('idle')
    })
  })


  describe('事件處理', () => {
    describe('addConnectionFromEvent', () => {
      it('應新增不重複的 Connection、createdAt 轉為 Date、status 預設 idle', () => {
        const store = useConnectionStore()

        const connEvent = {
          id: 'conn-1',
          sourcePodId: 'pod-a',
          sourceAnchor: 'bottom' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'top' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          triggerMode: 'auto' as TriggerMode,
        }

        store.addConnectionFromEvent(connEvent)

        expect(store.connections).toHaveLength(1)
        expect(store.connections[0]).toMatchObject({
          id: 'conn-1',
          sourcePodId: 'pod-a',
          targetPodId: 'pod-b',
          triggerMode: 'auto',
          status: 'idle',
        })
        expect(store.connections[0]?.createdAt).toBeInstanceOf(Date)
      })

      it('已存在的 Connection 不應重複新增', () => {
        const store = useConnectionStore()
        const existingConn = createMockConnection({ id: 'conn-1' })
        store.connections = [existingConn]

        const connEvent = {
          id: 'conn-1',
          sourceAnchor: 'bottom' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'top' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          triggerMode: 'auto' as TriggerMode,
        }

        store.addConnectionFromEvent(connEvent)

        expect(store.connections).toHaveLength(1)
      })

      it('triggerMode 未提供時應預設 auto', () => {
        const store = useConnectionStore()

        const connEvent = {
          id: 'conn-1',
          sourceAnchor: 'bottom' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'top' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
        }

        store.addConnectionFromEvent(connEvent as any)

        expect(store.connections[0]?.triggerMode).toBe('auto')
      })
    })

    describe('updateConnectionFromEvent', () => {
      it('應更新指定 Connection、保留現有 status 和 decideReason', () => {
        const store = useConnectionStore()
        const existingConn = createMockConnection({
          id: 'conn-1',
          triggerMode: 'auto',
          status: 'active',
          decideReason: 'existing reason',
        })
        store.connections = [existingConn]

        const connEvent = {
          id: 'conn-1',
          sourcePodId: 'pod-new',
          sourceAnchor: 'left' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'right' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          triggerMode: 'direct' as TriggerMode,
        }

        store.updateConnectionFromEvent(connEvent)

        expect(store.connections[0]).toMatchObject({
          id: 'conn-1',
          sourcePodId: 'pod-new',
          sourceAnchor: 'left',
          triggerMode: 'direct',
          status: 'active', // 保留
          decideReason: 'existing reason', // 保留
        })
      })

      it('Connection 不存在時不應報錯', () => {
        const store = useConnectionStore()

        const connEvent = {
          id: 'non-existent',
          sourceAnchor: 'bottom' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'top' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          triggerMode: 'auto' as TriggerMode,
        }

        expect(() => store.updateConnectionFromEvent(connEvent)).not.toThrow()
        expect(store.connections).toHaveLength(0)
      })

      it('event 提供 decideReason 時應覆蓋', () => {
        const store = useConnectionStore()
        const existingConn = createMockConnection({
          id: 'conn-1',
          status: 'ai-rejected',
          decideReason: 'old reason',
        })
        store.connections = [existingConn]

        const connEvent = {
          id: 'conn-1',
          sourceAnchor: 'bottom' as const,
          targetPodId: 'pod-b',
          targetAnchor: 'top' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          triggerMode: 'ai-decide' as TriggerMode,
          decideReason: 'new reason',
        }

        store.updateConnectionFromEvent(connEvent)

        expect(store.connections[0]?.decideReason).toBe('new reason')
      })
    })

    describe('removeConnectionFromEvent', () => {
      it('應移除指定 Connection', () => {
        const store = useConnectionStore()
        const conn1 = createMockConnection({ id: 'conn-1' })
        const conn2 = createMockConnection({ id: 'conn-2' })
        store.connections = [conn1, conn2]

        store.removeConnectionFromEvent('conn-1')

        expect(store.connections).toHaveLength(1)
        expect(store.connections[0]?.id).toBe('conn-2')
      })
    })
  })

  describe('loadConnectionsFromBackend', () => {
    it('成功時應設定 connections、triggerMode 預設 auto、status 直接使用 connectionStatus', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connections: [
          {
            id: 'conn-1',
            sourcePodId: 'pod-a',
            sourceAnchor: 'bottom',
            targetPodId: 'pod-b',
            targetAnchor: 'top',
            createdAt: '2024-01-01T00:00:00.000Z',
            triggerMode: 'auto',
            connectionStatus: 'idle',
          },
          {
            id: 'conn-2',
            sourcePodId: 'pod-b',
            sourceAnchor: 'bottom',
            targetPodId: 'pod-c',
            targetAnchor: 'top',
            createdAt: '2024-01-02T00:00:00.000Z',
            connectionStatus: 'ai-approved',
          },
        ],
      })

      await store.loadConnectionsFromBackend()

      expect(store.connections).toHaveLength(2)
      expect(store.connections[0]).toMatchObject({
        id: 'conn-1',
        triggerMode: 'auto',
        status: 'idle',
      })
      expect(store.connections[1]).toMatchObject({
        id: 'conn-2',
        triggerMode: 'auto', // 預設
        status: 'ai-approved', // 直接使用後端回傳的 connectionStatus
      })
      expect(store.connections[0]?.createdAt).toBeInstanceOf(Date)
    })

    it('無 activeCanvasId 時不應載入', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const store = useConnectionStore()

      await store.loadConnectionsFromBackend()

      expect(console.warn).toHaveBeenCalledWith('[ConnectionStore] 沒有啟用的畫布')
      expect(mockCreateWebSocketRequest).not.toHaveBeenCalled()
    })

    it('後端未回傳 connectionStatus 時應 fallback 為 idle', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connections: [
          {
            id: 'conn-1',
            sourceAnchor: 'bottom',
            targetPodId: 'pod-b',
            targetAnchor: 'top',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      })

      await store.loadConnectionsFromBackend()

      expect(store.connections[0]?.status).toBe('idle')
    })

    it('connectionStatus 為 ai-deciding 時應正確設定', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connections: [
          {
            id: 'conn-1',
            sourceAnchor: 'bottom',
            targetPodId: 'pod-b',
            targetAnchor: 'top',
            createdAt: '2024-01-01T00:00:00.000Z',
            connectionStatus: 'ai-deciding',
          },
        ],
      })

      await store.loadConnectionsFromBackend()

      expect(store.connections[0]?.status).toBe('ai-deciding')
    })

    it('decideReason 應正確設定', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useConnectionStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connections: [
          {
            id: 'conn-1',
            sourceAnchor: 'bottom',
            targetPodId: 'pod-b',
            targetAnchor: 'top',
            createdAt: '2024-01-01T00:00:00.000Z',
            connectionStatus: 'ai-rejected',
            decideReason: 'Not relevant',
          },
        ],
      })

      await store.loadConnectionsFromBackend()

      expect(store.connections[0]?.status).toBe('ai-rejected')
      expect(store.connections[0]?.decideReason).toBe('Not relevant')
    })
  })

  describe('selectConnection', () => {
    it('應設定 selectedConnectionId', () => {
      const store = useConnectionStore()

      store.selectConnection('conn-123')

      expect(store.selectedConnectionId).toBe('conn-123')
    })

    it('可以清除選取', () => {
      const store = useConnectionStore()
      store.selectedConnectionId = 'conn-123'

      store.selectConnection(null)

      expect(store.selectedConnectionId).toBeNull()
    })
  })
})
