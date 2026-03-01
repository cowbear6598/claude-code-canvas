import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { mockWebSocketModule, mockCreateWebSocketRequest, resetMockWebSocket } from '../helpers/mockWebSocket'
import { createMockCanvas, createMockPod, createMockConnection, createMockNote, createMockSchedule } from '../helpers/factories'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePodStore } from '@/stores/pod/podStore'
import { useConnectionStore } from '@/stores/connectionStore'
import type { Canvas, Pod, Connection } from '@/types'

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
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()
const mockToast = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

// Mock sanitizeErrorForUser
vi.mock('@/utils/errorSanitizer', () => ({
  sanitizeErrorForUser: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return '未知錯誤'
  }),
}))

describe('Canvas/Pod 操作完整流程', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()
  })

  describe('建立 Canvas 並新增 Pod', () => {
    it('建立 Canvas -> 建立 Pod -> Pod 加入到正確的 Canvas', async () => {
      const canvasStore = useCanvasStore()
      const podStore = usePodStore()

      // Arrange
      const newCanvas = createMockCanvas({ id: 'canvas-1', name: 'Test Canvas' })
      const newPod = createMockPod({ id: 'pod-1', name: 'Test Pod', x: 300, y: 400 })

      // Mock CANVAS_CREATE
      mockCreateWebSocketRequest.mockResolvedValueOnce({ canvas: newCanvas })
      // Mock CANVAS_SWITCH
      mockCreateWebSocketRequest.mockResolvedValueOnce({ success: true, canvasId: newCanvas.id })
      // Mock POD_CREATE
      mockCreateWebSocketRequest.mockResolvedValueOnce({ pod: newPod })

      // Act - 建立 Canvas
      const canvas = await canvasStore.createCanvas('Test Canvas')

      // Assert - Canvas 建立成功且成為 activeCanvas
      expect(canvas).toEqual(newCanvas)
      expect(canvasStore.activeCanvasId).toBe('canvas-1')

      // Act - 建立 Pod
      const pod = await podStore.createPodWithBackend({
        name: 'Test Pod',
        x: 300,
        y: 400,
        rotation: 0,
        output: [],
        status: 'idle',
        model: 'opus',
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        repositoryId: null,
        autoClear: false,
        commandId: null,
        schedule: null,
      })

      // Assert - Pod 建立成功且包含正確的 canvasId
      expect(pod).toBeTruthy()
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            canvasId: 'canvas-1',
            name: 'Test Pod',
          }),
        })
      )
    })

    it('驗證跨 Store 狀態一致性（canvasStore.activeCanvasId, podStore.pods）', async () => {
      const canvasStore = useCanvasStore()
      const podStore = usePodStore()

      // Arrange
      const canvas1 = createMockCanvas({ id: 'canvas-1', name: 'Canvas 1' })
      const canvas2 = createMockCanvas({ id: 'canvas-2', name: 'Canvas 2' })

      // Mock loadCanvases
      mockCreateWebSocketRequest.mockResolvedValueOnce({ canvases: [canvas1, canvas2] })
      mockCreateWebSocketRequest.mockResolvedValueOnce({ success: true, canvasId: canvas1.id })

      // Act - 載入 Canvas 列表
      await canvasStore.loadCanvases()

      // Assert - 第一個 Canvas 自動成為 active
      expect(canvasStore.activeCanvasId).toBe('canvas-1')
      expect(canvasStore.canvases).toHaveLength(2)

      // Arrange - 建立 Pod
      const pod1 = createMockPod({ id: 'pod-1', name: 'Pod 1' })
      mockCreateWebSocketRequest.mockResolvedValueOnce({ pod: pod1 })

      // Act - 在 canvas-1 建立 Pod
      await podStore.createPodWithBackend({
        name: 'Pod 1',
        x: 100,
        y: 100,
        rotation: 0,
        output: [],
        status: 'idle',
        model: 'opus',
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        repositoryId: null,
        autoClear: false,
        commandId: null,
        schedule: null,
      })

      // Assert - Pod 建立時使用正確的 activeCanvasId
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            canvasId: 'canvas-1',
          }),
        })
      )

      // Act - 切換到 canvas-2
      mockCreateWebSocketRequest.mockResolvedValueOnce({ success: true, canvasId: 'canvas-2' })
      await canvasStore.switchCanvas('canvas-2')

      // Assert - activeCanvasId 更新
      expect(canvasStore.activeCanvasId).toBe('canvas-2')

      // Act - 在 canvas-2 建立 Pod
      const pod2 = createMockPod({ id: 'pod-2', name: 'Pod 2' })
      mockCreateWebSocketRequest.mockResolvedValueOnce({ pod: pod2 })

      await podStore.createPodWithBackend({
        name: 'Pod 2',
        x: 200,
        y: 200,
        rotation: 0,
        output: [],
        status: 'idle',
        model: 'sonnet',
        outputStyleId: null,
        skillIds: [],
        subAgentIds: [],
        repositoryId: null,
        autoClear: false,
        commandId: null,
        schedule: null,
      })

      // Assert - 新 Pod 建立時使用更新後的 activeCanvasId
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            canvasId: 'canvas-2',
          }),
        })
      )
    })
  })

  describe('Pod 設定與 Note 綁定', () => {
    it('建立 Pod -> 設定 Model -> 綁定 OutputStyle Note', () => {
      const podStore = usePodStore()

      // Arrange
      const pod = createMockPod({ id: 'pod-1', model: 'opus', outputStyleId: null })
      podStore.pods = [pod]

      // Act - 更新 Model
      podStore.updatePodModel('pod-1', 'sonnet')

      // Assert - Model 已更新
      expect(podStore.getPodById('pod-1')?.model).toBe('sonnet')

      // Act - 綁定 OutputStyle
      podStore.updatePodOutputStyle('pod-1', 'output-style-1')

      // Assert - outputStyleId 已更新
      expect(podStore.getPodById('pod-1')?.outputStyleId).toBe('output-style-1')
    })

    it('驗證 Pod 的 outputStyleId 更新', () => {
      const podStore = usePodStore()

      // Arrange
      const pod = createMockPod({ id: 'pod-1', outputStyleId: null })
      podStore.pods = [pod]

      // Act
      podStore.updatePodOutputStyle('pod-1', 'style-123')

      // Assert
      const updatedPod = podStore.getPodById('pod-1')
      expect(updatedPod?.outputStyleId).toBe('style-123')
    })

    it('驗證清除 outputStyleId', () => {
      const podStore = usePodStore()

      // Arrange
      const pod = createMockPod({ id: 'pod-1', outputStyleId: 'style-123' })
      podStore.pods = [pod]

      // Act
      podStore.updatePodOutputStyle('pod-1', null)

      // Assert
      expect(podStore.getPodById('pod-1')?.outputStyleId).toBeNull()
    })
  })

  describe('建立連接並觸發工作流', () => {
    it('建立 2 個 Pod -> 建立 Connection -> 模擬 Auto Trigger', async () => {
      const canvasStore = useCanvasStore()
      const podStore = usePodStore()
      const connectionStore = useConnectionStore()

      // Arrange
      canvasStore.activeCanvasId = 'canvas-1'

      const pod1 = createMockPod({ id: 'pod-1', name: 'Pod 1' })
      const pod2 = createMockPod({ id: 'pod-2', name: 'Pod 2' })
      podStore.pods = [pod1, pod2]

      const newConnection = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
        triggerMode: 'auto',
        status: 'idle',
      })

      // Mock CONNECTION_CREATE
      mockCreateWebSocketRequest.mockResolvedValueOnce({
        connection: {
          ...newConnection,
        },
      })

      // Act - 建立 Connection
      const connection = await connectionStore.createConnection('pod-1', 'bottom', 'pod-2', 'top')

      // Assert - Connection 建立成功
      expect(connection).toBeTruthy()
      expect(connection?.sourcePodId).toBe('pod-1')
      expect(connection?.targetPodId).toBe('pod-2')
      expect(connection?.triggerMode).toBe('auto')
      expect(connection?.status).toBe('idle')

      // Act - 模擬 WORKFLOW_AUTO_TRIGGERED
      connectionStore.addConnectionFromEvent({
        ...newConnection,
      })
      connectionStore.handleWorkflowAutoTriggered({
        connectionId: 'conn-1',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
        transferredContent: 'test content',
        isSummarized: false,
      })

      // Assert - Connection 狀態從 idle -> active
      const activeConnection = connectionStore.connections.find((c) => c.id === 'conn-1')
      expect(activeConnection?.status).toBe('active')

      // Act - 模擬 WORKFLOW_COMPLETE
      connectionStore.handleWorkflowComplete({
        requestId: 'req-1',
        connectionId: 'conn-1',
        targetPodId: 'pod-2',
        success: true,
        triggerMode: 'auto',
      })

      // Assert - Connection 狀態從 active -> idle
      const idleConnection = connectionStore.connections.find((c) => c.id === 'conn-1')
      expect(idleConnection?.status).toBe('idle')
    })

    it('驗證 Connection 狀態從 idle -> active -> idle', () => {
      const connectionStore = useConnectionStore()

      // Arrange
      const conn = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        triggerMode: 'auto',
        status: 'idle',
      })
      connectionStore.connections = [conn]

      // Assert - 初始狀態為 idle
      expect(connectionStore.connections[0]?.status).toBe('idle')

      // Act - 觸發工作流
      connectionStore.handleWorkflowAutoTriggered({
        connectionId: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        transferredContent: 'content',
        isSummarized: false,
      })

      // Assert - 狀態變為 active
      expect(connectionStore.connections[0]?.status).toBe('active')

      // Act - 完成工作流
      connectionStore.handleWorkflowComplete({
        requestId: 'req-1',
        connectionId: 'conn-1',
        targetPodId: 'pod-b',
        success: true,
        triggerMode: 'auto',
      })

      // Assert - 狀態回到 idle
      expect(connectionStore.connections[0]?.status).toBe('idle')
    })

    it('驗證 AI Decide 流程：idle -> ai-deciding -> ai-approved', () => {
      const connectionStore = useConnectionStore()

      // Arrange
      const conn = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        triggerMode: 'ai-decide',
        status: 'idle',
      })
      connectionStore.connections = [conn]

      // Assert - 初始狀態為 idle
      expect(connectionStore.connections[0]?.status).toBe('idle')

      // Act - AI Decide Pending
      connectionStore.handleAiDecidePending({
        canvasId: 'canvas-1',
        connectionIds: ['conn-1'],
        sourcePodId: 'pod-a',
      })

      // Assert - 狀態變為 ai-deciding
      expect(connectionStore.connections[0]?.status).toBe('ai-deciding')
      expect(connectionStore.connections[0]?.decideReason).toBeUndefined()

      // Act - AI Decide Result (approved)
      connectionStore.handleAiDecideResult({
        canvasId: 'canvas-1',
        connectionId: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        shouldTrigger: true,
        reason: 'approved',
      })

      // Assert - 狀態變為 ai-approved
      expect(connectionStore.connections[0]?.status).toBe('ai-approved')
      expect(connectionStore.connections[0]?.decideReason).toBeUndefined()
    })

    it('驗證 AI Decide 流程：idle -> ai-deciding -> ai-rejected', () => {
      const connectionStore = useConnectionStore()

      // Arrange
      const conn = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        triggerMode: 'ai-decide',
        status: 'idle',
      })
      connectionStore.connections = [conn]

      // Act - AI Decide Pending
      connectionStore.handleAiDecidePending({
        canvasId: 'canvas-1',
        connectionIds: ['conn-1'],
        sourcePodId: 'pod-a',
      })

      // Assert - 狀態變為 ai-deciding
      expect(connectionStore.connections[0]?.status).toBe('ai-deciding')

      // Act - AI Decide Result (rejected)
      connectionStore.handleAiDecideResult({
        canvasId: 'canvas-1',
        connectionId: 'conn-1',
        sourcePodId: 'pod-a',
        targetPodId: 'pod-b',
        shouldTrigger: false,
        reason: 'not relevant',
      })

      // Assert - 狀態變為 ai-rejected + decideReason
      expect(connectionStore.connections[0]?.status).toBe('ai-rejected')
      expect(connectionStore.connections[0]?.decideReason).toBe('not relevant')

      // Act - AI Decide Clear
      connectionStore.handleAiDecideClear({
        canvasId: 'canvas-1',
        connectionIds: ['conn-1'],
      })

      // Assert - 狀態回到 idle + 清除 decideReason
      expect(connectionStore.connections[0]?.status).toBe('idle')
      expect(connectionStore.connections[0]?.decideReason).toBeUndefined()
    })
  })

  describe('排程觸發', () => {
    it('設定排程 -> 模擬 SCHEDULE_FIRED 事件 -> 驗證動畫狀態', async () => {
      const canvasStore = useCanvasStore()
      const podStore = usePodStore()

      // Arrange
      canvasStore.activeCanvasId = 'canvas-1'

      const pod = createMockPod({ id: 'pod-1', schedule: null })
      podStore.pods = [pod]

      const schedule = createMockSchedule({ enabled: true })
      const updatedPod = createMockPod({ id: 'pod-1', schedule })

      // Mock POD_SET_SCHEDULE
      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: true,
        pod: updatedPod,
      })

      // Act - 設定排程
      const result = await podStore.setScheduleWithBackend('pod-1', schedule)

      // Assert - 排程設定成功
      expect(result).toBeTruthy()
      expect(result?.schedule).toEqual(schedule)
      expect(mockShowSuccessToast).toHaveBeenCalledWith('Schedule', '更新成功')

      // Act - 模擬 SCHEDULE_FIRED 事件觸發動畫
      podStore.triggerScheduleFiredAnimation('pod-1')

      // Assert - Pod 在 scheduleFiredPodIds 中
      expect(podStore.isScheduleFiredAnimating('pod-1')).toBe(true)

      // Act - 清除動畫
      podStore.clearScheduleFiredAnimation('pod-1')

      // Assert - Pod 不在 scheduleFiredPodIds 中
      expect(podStore.isScheduleFiredAnimating('pod-1')).toBe(false)
    })

    it('驗證多個 Pod 的排程動畫狀態互不影響', () => {
      const podStore = usePodStore()

      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      const pod2 = createMockPod({ id: 'pod-2' })
      podStore.pods = [pod1, pod2]

      // Act - 觸發 pod-1 動畫
      podStore.triggerScheduleFiredAnimation('pod-1')

      // Assert
      expect(podStore.isScheduleFiredAnimating('pod-1')).toBe(true)
      expect(podStore.isScheduleFiredAnimating('pod-2')).toBe(false)

      // Act - 觸發 pod-2 動畫
      podStore.triggerScheduleFiredAnimation('pod-2')

      // Assert - 兩個都在動畫中
      expect(podStore.isScheduleFiredAnimating('pod-1')).toBe(true)
      expect(podStore.isScheduleFiredAnimating('pod-2')).toBe(true)

      // Act - 清除 pod-1 動畫
      podStore.clearScheduleFiredAnimation('pod-1')

      // Assert - pod-1 已清除，pod-2 仍在
      expect(podStore.isScheduleFiredAnimating('pod-1')).toBe(false)
      expect(podStore.isScheduleFiredAnimating('pod-2')).toBe(true)
    })

    it('清除排程時應顯示清除成功 Toast', async () => {
      const canvasStore = useCanvasStore()
      const podStore = usePodStore()

      // Arrange
      canvasStore.activeCanvasId = 'canvas-1'

      const schedule = createMockSchedule()
      const pod = createMockPod({ id: 'pod-1', schedule })
      podStore.pods = [pod]

      const updatedPod = createMockPod({ id: 'pod-1', schedule: null })

      // Mock POD_SET_SCHEDULE (清除)
      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: true,
        pod: updatedPod,
      })

      // Act - 清除排程
      const result = await podStore.setScheduleWithBackend('pod-1', null)

      // Assert
      expect(result).toBeTruthy()
      expect(result?.schedule).toBeNull()
      expect(mockShowSuccessToast).toHaveBeenCalledWith('Schedule', '清除成功')
    })
  })
})
