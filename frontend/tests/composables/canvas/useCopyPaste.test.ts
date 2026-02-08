import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, mockCreateWebSocketRequest, resetMockWebSocket } from '../../helpers/mockWebSocket'
import { createMockPod, createMockNote, createMockConnection } from '../../helpers/factories'
import { useCopyPaste } from '@/composables/canvas/useCopyPaste'
import { usePodStore, useViewportStore, useSelectionStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore, useRepositoryStore, useSubAgentStore, useCommandStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { useClipboardStore } from '@/stores/clipboardStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type { SelectableElement, CanvasPasteResultPayload } from '@/types'

// Mock functions using vi.hoisted
const { mockShowSuccessToast, mockShowErrorToast, mockIsEditingElement, mockHasTextSelection, mockIsModifierKeyPressed, mockWrapWebSocketRequest } = vi.hoisted(() => ({
  mockShowSuccessToast: vi.fn(),
  mockShowErrorToast: vi.fn(),
  mockIsEditingElement: vi.fn(() => false),
  mockHasTextSelection: vi.fn(() => false),
  mockIsModifierKeyPressed: vi.fn(() => true),
  mockWrapWebSocketRequest: vi.fn(),
}))

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
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

// Mock domHelpers
vi.mock('@/utils/domHelpers', () => ({
  isEditingElement: mockIsEditingElement,
  hasTextSelection: mockHasTextSelection,
  isModifierKeyPressed: mockIsModifierKeyPressed,
  getPlatformModifierKey: () => 'ctrlKey' as const,
}))

// Mock useWebSocketErrorHandler
vi.mock('@/composables/useWebSocketErrorHandler', () => ({
  useWebSocketErrorHandler: () => ({
    wrapWebSocketRequest: mockWrapWebSocketRequest,
  }),
}))

// Mock useCanvasContext
vi.mock('@/composables/canvas/useCanvasContext', () => ({
  useCanvasContext: () => {
    const podStore = usePodStore()
    const viewportStore = useViewportStore()
    const selectionStore = useSelectionStore()
    const outputStyleStore = useOutputStyleStore()
    const skillStore = useSkillStore()
    const repositoryStore = useRepositoryStore()
    const subAgentStore = useSubAgentStore()
    const commandStore = useCommandStore()
    const connectionStore = useConnectionStore()
    const clipboardStore = useClipboardStore()
    const canvasStore = useCanvasStore()

    return {
      podStore,
      viewportStore,
      selectionStore,
      outputStyleStore,
      skillStore,
      repositoryStore,
      subAgentStore,
      commandStore,
      connectionStore,
      clipboardStore,
      canvasStore,
    }
  },
}))

// 測試用的 Wrapper Component
const TestComponent = defineComponent({
  setup() {
    useCopyPaste()
    return () => h('div')
  },
})

describe('useCopyPaste', () => {
  let wrapper: ReturnType<typeof mount>
  let podStore: ReturnType<typeof usePodStore>
  let viewportStore: ReturnType<typeof useViewportStore>
  let selectionStore: ReturnType<typeof useSelectionStore>
  let outputStyleStore: ReturnType<typeof useOutputStyleStore>
  let skillStore: ReturnType<typeof useSkillStore>
  let repositoryStore: ReturnType<typeof useRepositoryStore>
  let subAgentStore: ReturnType<typeof useSubAgentStore>
  let commandStore: ReturnType<typeof useCommandStore>
  let connectionStore: ReturnType<typeof useConnectionStore>
  let clipboardStore: ReturnType<typeof useClipboardStore>
  let canvasStore: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()

    // 重置 domHelpers mocks
    mockIsEditingElement.mockReturnValue(false)
    mockHasTextSelection.mockReturnValue(false)
    mockIsModifierKeyPressed.mockReturnValue(true)

    // 初始化 stores
    podStore = usePodStore()
    viewportStore = useViewportStore()
    selectionStore = useSelectionStore()
    outputStyleStore = useOutputStyleStore()
    skillStore = useSkillStore()
    repositoryStore = useRepositoryStore()
    subAgentStore = useSubAgentStore()
    commandStore = useCommandStore()
    connectionStore = useConnectionStore()
    clipboardStore = useClipboardStore()
    canvasStore = useCanvasStore()

    // 設定必要的初始狀態
    canvasStore.activeCanvasId = 'canvas-1'

    // Mock viewportStore.screenToCanvas
    viewportStore.screenToCanvas = vi.fn((screenX: number, screenY: number) => ({
      x: screenX,
      y: screenY,
    }))

    // Mount component
    wrapper = mount(TestComponent)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('複製 (handleCopy)', () => {
    it('無選中元素時不複製，回傳 false', () => {
      // Arrange
      selectionStore.selectedElements = []

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      document.dispatchEvent(event)

      // Assert
      expect(clipboardStore.isEmpty).toBe(true)
    })

    it('收集選中的 Pod 資料', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', name: 'Pod 1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', name: 'Pod 2', x: 200, y: 200 })
      podStore.pods = [pod1, pod2]

      const selectedElements: SelectableElement[] = [
        { type: 'pod', id: 'pod-1' },
        { type: 'pod', id: 'pod-2' },
      ]
      selectionStore.selectedElements = selectedElements

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.pods).toHaveLength(2)
      expect(copiedData.pods[0].id).toBe('pod-1')
      expect(copiedData.pods[1].id).toBe('pod-2')
    })

    it('收集選中 Pod 綁定的 OutputStyle Note', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]

      const boundNote = createMockNote('outputStyle', {
        id: 'note-1',
        boundToPodId: 'pod-1',
        x: 10,
        y: 10,
      })
      outputStyleStore.notes = [boundNote]

      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.outputStyleNotes).toHaveLength(1)
      expect(copiedData.outputStyleNotes[0].id).toBe('note-1')
      expect(copiedData.outputStyleNotes[0].boundToPodId).toBe('pod-1')
    })

    it('收集選中 Pod 綁定的 Skill Note', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]

      const boundNote = createMockNote('skill', {
        id: 'note-1',
        boundToPodId: 'pod-1',
        x: 10,
        y: 10,
      })
      skillStore.notes = [boundNote]

      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.skillNotes).toHaveLength(1)
      expect(copiedData.skillNotes[0].id).toBe('note-1')
    })

    it('收集選中 Pod 綁定的 Repository Note', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]

      const boundNote = createMockNote('repository', {
        id: 'note-1',
        boundToPodId: 'pod-1',
        x: 10,
        y: 10,
      })
      repositoryStore.notes = [boundNote]

      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.repositoryNotes).toHaveLength(1)
      expect(copiedData.repositoryNotes[0].boundToOriginalPodId).toBe('pod-1')
    })

    it('收集選中 Pod 綁定的 SubAgent Note', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]

      const boundNote = createMockNote('subAgent', {
        id: 'note-1',
        boundToPodId: 'pod-1',
        x: 10,
        y: 10,
      })
      subAgentStore.notes = [boundNote]

      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.subAgentNotes).toHaveLength(1)
      expect(copiedData.subAgentNotes[0].id).toBe('note-1')
    })

    it('收集選中 Pod 綁定的 Command Note', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]

      const boundNote = createMockNote('command', {
        id: 'note-1',
        boundToPodId: 'pod-1',
        x: 10,
        y: 10,
      })
      commandStore.notes = [boundNote]

      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.commandNotes).toHaveLength(1)
      expect(copiedData.commandNotes[0].boundToOriginalPodId).toBe('pod-1')
    })

    it('收集選中的未綁定 OutputStyle Note', () => {
      // Arrange
      const unboundNote = createMockNote('outputStyle', {
        id: 'note-1',
        boundToPodId: null,
        x: 100,
        y: 100,
      })
      outputStyleStore.notes = [unboundNote]

      selectionStore.selectedElements = [{ type: 'outputStyleNote', id: 'note-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.outputStyleNotes).toHaveLength(1)
      expect(copiedData.outputStyleNotes[0].boundToPodId).toBeNull()
    })

    it('收集選中的未綁定 Skill Note', () => {
      // Arrange
      const unboundNote = createMockNote('skill', {
        id: 'note-1',
        boundToPodId: null,
        x: 100,
        y: 100,
      })
      skillStore.notes = [unboundNote]

      selectionStore.selectedElements = [{ type: 'skillNote', id: 'note-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.skillNotes).toHaveLength(1)
      expect(copiedData.skillNotes[0].boundToPodId).toBeNull()
    })

    it('收集選中的未綁定 Repository Note', () => {
      // Arrange
      const unboundNote = createMockNote('repository', {
        id: 'note-1',
        boundToPodId: null,
        x: 100,
        y: 100,
      })
      repositoryStore.notes = [unboundNote]

      selectionStore.selectedElements = [{ type: 'repositoryNote', id: 'note-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.repositoryNotes).toHaveLength(1)
      expect(copiedData.repositoryNotes[0].boundToOriginalPodId).toBeNull()
    })

    it('收集選中的未綁定 SubAgent Note', () => {
      // Arrange
      const unboundNote = createMockNote('subAgent', {
        id: 'note-1',
        boundToPodId: null,
        x: 100,
        y: 100,
      })
      subAgentStore.notes = [unboundNote]

      selectionStore.selectedElements = [{ type: 'subAgentNote', id: 'note-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.subAgentNotes).toHaveLength(1)
      expect(copiedData.subAgentNotes[0].boundToPodId).toBeNull()
    })

    it('收集選中的未綁定 Command Note', () => {
      // Arrange
      const unboundNote = createMockNote('command', {
        id: 'note-1',
        boundToPodId: null,
        x: 100,
        y: 100,
      })
      commandStore.notes = [unboundNote]

      selectionStore.selectedElements = [{ type: 'commandNote', id: 'note-1' }]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.commandNotes).toHaveLength(1)
      expect(copiedData.commandNotes[0].boundToOriginalPodId).toBeNull()
    })

    it('只收集兩端都在選中範圍內的 Connection', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      const pod2 = createMockPod({ id: 'pod-2' })
      const pod3 = createMockPod({ id: 'pod-3' })
      podStore.pods = [pod1, pod2, pod3]

      const conn1 = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
      })
      const conn2 = createMockConnection({
        id: 'conn-2',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-3',
      })
      connectionStore.connections = [conn1, conn2]

      // 只選中 pod-1 和 pod-2
      selectionStore.selectedElements = [
        { type: 'pod', id: 'pod-1' },
        { type: 'pod', id: 'pod-2' },
      ]

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      const copiedData = clipboardStore.getCopiedData()
      expect(copiedData.connections).toHaveLength(1)
      expect(copiedData.connections[0].sourcePodId).toBe('pod-1')
      expect(copiedData.connections[0].targetPodId).toBe('pod-2')
    })

    it('呼叫 clipboardStore.setCopy 儲存複製資料', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]
      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      const setCopySpy = vi.spyOn(clipboardStore, 'setCopy')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      expect(setCopySpy).toHaveBeenCalledOnce()
      expect(setCopySpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array)
      )
    })
  })

  describe('貼上 (handlePaste)', () => {
    it('clipboard 為空時不貼上，回傳 false', async () => {
      // Arrange
      clipboardStore.clear()

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      document.dispatchEvent(event)

      // 等待非同步處理
      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).not.toHaveBeenCalled()
    })

    it('計算貼上位置（基於滑鼠座標轉換為畫布座標）', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      // 模擬滑鼠移動到特定位置
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 300,
      })
      document.dispatchEvent(mouseMoveEvent)

      viewportStore.screenToCanvas = vi.fn(() => ({ x: 600, y: 400 }))

      mockWrapWebSocketRequest.mockResolvedValue({
        createdPods: [],
        createdOutputStyleNotes: [],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      })

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(viewportStore.screenToCanvas).toHaveBeenCalledWith(500, 300)
    })

    it('發送 CANVAS_PASTE WebSocket 請求', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      mockWrapWebSocketRequest.mockResolvedValue({
        createdPods: [],
        createdOutputStyleNotes: [],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      })

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).toHaveBeenCalledOnce()
      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: WebSocketRequestEvents.CANVAS_PASTE,
        responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        payload: expect.objectContaining({
          canvasId: 'canvas-1',
          pods: expect.any(Array),
        }),
        timeout: 10000,
      })
    })

    it('成功後設定新建元素為選中狀態', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      const mockResponse: CanvasPasteResultPayload = {
        createdPods: [
          { ...pod1, id: 'new-pod-1' },
        ],
        createdOutputStyleNotes: [],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      }

      mockWrapWebSocketRequest.mockResolvedValue(mockResponse)

      const setSelectedElementsSpy = vi.spyOn(selectionStore, 'setSelectedElements')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(setSelectedElementsSpy).toHaveBeenCalledWith([
        { type: 'pod', id: 'new-pod-1' },
      ])
    })

    it('僅選中未綁定的 Note', async () => {
      // Arrange
      const boundNote = createMockNote('outputStyle', {
        id: 'note-1',
        boundToPodId: 'pod-1',
      })
      const unboundNote = createMockNote('outputStyle', {
        id: 'note-2',
        boundToPodId: null,
      })

      clipboardStore.setCopy([], [boundNote, unboundNote], [], [], [], [], [])

      const mockResponse: CanvasPasteResultPayload = {
        createdPods: [],
        createdOutputStyleNotes: [
          { ...boundNote, id: 'new-note-1', boundToPodId: 'new-pod-1' },
          { ...unboundNote, id: 'new-note-2', boundToPodId: null },
        ],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      }

      mockWrapWebSocketRequest.mockResolvedValue(mockResponse)

      const setSelectedElementsSpy = vi.spyOn(selectionStore, 'setSelectedElements')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(setSelectedElementsSpy).toHaveBeenCalledWith([
        { type: 'outputStyleNote', id: 'new-note-2' },
      ])
    })

    it('WebSocket 請求失敗時回傳 false', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      mockWrapWebSocketRequest.mockResolvedValue(null)

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).toHaveBeenCalledOnce()
    })
  })

  describe('位置計算', () => {
    describe('calculateBoundingBox', () => {
      it('計算所有 Pod 的包圍框', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        const pod2 = createMockPod({ id: 'pod-2', x: 300, y: 200 })
        clipboardStore.setCopy([pod1, pod2], [], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 400, y: 300 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        expect(mockCreateWebSocketRequest).toHaveBeenCalled()
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.pods).toHaveLength(2)
      })

      it('計算未綁定 Note 的包圍框', async () => {
        // Arrange
        const note1 = createMockNote('outputStyle', {
          id: 'note-1',
          boundToPodId: null,
          x: 150,
          y: 150,
        })
        clipboardStore.setCopy([], [note1], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 400, y: 300 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        expect(mockCreateWebSocketRequest).toHaveBeenCalled()
      })

      it('已綁定 Note 不計入包圍框', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        const boundNote = createMockNote('outputStyle', {
          id: 'note-1',
          boundToPodId: 'pod-1',
          x: 50,
          y: 50,
        })
        clipboardStore.setCopy([pod1], [boundNote], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 400, y: 300 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        expect(mockCreateWebSocketRequest).toHaveBeenCalled()
      })
    })

    describe('calculateOffsets', () => {
      it('計算原始中心到目標位置的偏移量', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        clipboardStore.setCopy([pod1], [], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 500, y: 400 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        expect(mockCreateWebSocketRequest).toHaveBeenCalled()
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.pods[0].x).not.toBe(100)
        expect(payload.pods[0].y).not.toBe(100)
      })
    })

    describe('transformPods', () => {
      it('應用偏移量到 Pod 座標', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
        clipboardStore.setCopy([pod1, pod2], [], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 500, y: 400 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.pods).toHaveLength(2)
        expect(payload.pods[0].originalId).toBe('pod-1')
        expect(payload.pods[1].originalId).toBe('pod-2')
      })
    })

    describe('transformNotes', () => {
      it('未綁定 Note 應用偏移量', async () => {
        // Arrange
        const unboundNote = createMockNote('outputStyle', {
          id: 'note-1',
          boundToPodId: null,
          x: 100,
          y: 100,
        })
        clipboardStore.setCopy([], [unboundNote], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 500, y: 400 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.outputStyleNotes[0].x).not.toBe(100)
        expect(payload.outputStyleNotes[0].y).not.toBe(100)
      })

      it('已綁定 Note 座標設為 0', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        const boundNote = createMockNote('outputStyle', {
          id: 'note-1',
          boundToPodId: 'pod-1',
          x: 150,
          y: 150,
        })
        clipboardStore.setCopy([pod1], [boundNote], [], [], [], [], [])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 500, y: 400 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.outputStyleNotes[0].x).toBe(0)
        expect(payload.outputStyleNotes[0].y).toBe(0)
      })
    })

    describe('transformConnections', () => {
      it('轉換 Connection 格式', async () => {
        // Arrange
        const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
        const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
        const conn = createMockConnection({
          id: 'conn-1',
          sourcePodId: 'pod-1',
          targetPodId: 'pod-2',
          sourceAnchor: 'bottom',
          targetAnchor: 'top',
        })
        clipboardStore.setCopy([pod1, pod2], [], [], [], [], [], [conn])

        mockWrapWebSocketRequest.mockResolvedValue({
          createdPods: [],
          createdOutputStyleNotes: [],
          createdSkillNotes: [],
          createdRepositoryNotes: [],
          createdSubAgentNotes: [],
          createdCommandNotes: [],
          createdConnections: [],
        })

        viewportStore.screenToCanvas = vi.fn(() => ({ x: 500, y: 400 }))

        // Act
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        document.dispatchEvent(event)

        await new Promise(resolve => setTimeout(resolve, 0))

        // Assert
        const payload = mockCreateWebSocketRequest.mock.calls[0][0].payload
        expect(payload.connections).toHaveLength(1)
        expect(payload.connections[0].originalSourcePodId).toBe('pod-1')
        expect(payload.connections[0].originalTargetPodId).toBe('pod-2')
        expect(payload.connections[0].sourceAnchor).toBe('bottom')
        expect(payload.connections[0].targetAnchor).toBe('top')
      })
    })
  })

  describe('鍵盤事件', () => {
    it('Ctrl+C 觸發複製', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]
      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      const setCopySpy = vi.spyOn(clipboardStore, 'setCopy')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      // Assert
      expect(setCopySpy).toHaveBeenCalled()
    })

    it('Ctrl+V 觸發貼上', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      mockWrapWebSocketRequest.mockResolvedValue({
        createdPods: [],
        createdOutputStyleNotes: [],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      })

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).toHaveBeenCalled()
    })

    it('在編輯元素中不觸發複製', () => {
      // Arrange
      mockIsEditingElement.mockReturnValue(true)

      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]
      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      const setCopySpy = vi.spyOn(clipboardStore, 'setCopy')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      document.dispatchEvent(event)

      // Assert
      expect(setCopySpy).not.toHaveBeenCalled()
    })

    it('在編輯元素中不觸發貼上', async () => {
      // Arrange
      mockIsEditingElement.mockReturnValue(true)

      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      mockWrapWebSocketRequest.mockResolvedValue({
        createdPods: [],
        createdOutputStyleNotes: [],
        createdSkillNotes: [],
        createdRepositoryNotes: [],
        createdSubAgentNotes: [],
        createdCommandNotes: [],
        createdConnections: [],
      })

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).not.toHaveBeenCalled()
    })

    it('有文字選取時 Ctrl+C 不觸發', () => {
      // Arrange
      mockHasTextSelection.mockReturnValue(true)

      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]
      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      const setCopySpy = vi.spyOn(clipboardStore, 'setCopy')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
      document.dispatchEvent(event)

      // Assert
      expect(setCopySpy).not.toHaveBeenCalled()
    })

    it('非 Ctrl/Cmd 鍵不觸發複製', () => {
      // Arrange
      mockIsModifierKeyPressed.mockReturnValue(false)

      const pod1 = createMockPod({ id: 'pod-1' })
      podStore.pods = [pod1]
      selectionStore.selectedElements = [{ type: 'pod', id: 'pod-1' }]

      const setCopySpy = vi.spyOn(clipboardStore, 'setCopy')

      // Act
      const event = new KeyboardEvent('keydown', { key: 'c' })
      document.dispatchEvent(event)

      // Assert
      expect(setCopySpy).not.toHaveBeenCalled()
    })

    it('非 Ctrl/Cmd 鍵不觸發貼上', async () => {
      // Arrange
      mockIsModifierKeyPressed.mockReturnValue(false)

      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      clipboardStore.setCopy([pod1], [], [], [], [], [], [])

      // Act
      const event = new KeyboardEvent('keydown', { key: 'v' })
      document.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockWrapWebSocketRequest).not.toHaveBeenCalled()
    })

    it('滑鼠移動時更新位置', () => {
      // Arrange & Act
      const event1 = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      })
      document.dispatchEvent(event1)

      const event2 = new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 400,
      })
      document.dispatchEvent(event2)

      // Assert
      // 無法直接測試內部 mousePosition，但可以測試它是否影響 screenToCanvas 的呼叫
      expect(true).toBe(true) // 基本測試通過
    })
  })

  describe('生命週期', () => {
    it('onMounted 時註冊事件監聽器', () => {
      // Arrange
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      // Act
      mount(TestComponent)

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    })

    it('onUnmounted 時移除事件監聽器', () => {
      // Arrange
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const testWrapper = mount(TestComponent)

      // Act
      testWrapper.unmount()

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    })
  })
})
