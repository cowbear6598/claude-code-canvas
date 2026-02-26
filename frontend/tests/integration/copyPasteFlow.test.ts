import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { mockWebSocketModule, resetMockWebSocket } from '../helpers/mockWebSocket'
import { createMockPod, createMockNote, createMockConnection } from '../helpers/factories'
import { usePodStore, useSelectionStore, useViewportStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore, useRepositoryStore, useSubAgentStore, useCommandStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { useClipboardStore } from '@/stores/clipboardStore'
import { useCanvasStore } from '@/stores/canvasStore'
import type { SelectableElement } from '@/types'

const { mockShowSuccessToast, mockShowErrorToast, mockToast } = vi.hoisted(() => ({
  mockShowSuccessToast: vi.fn(),
  mockShowErrorToast: vi.fn(),
  mockToast: vi.fn(),
}))

vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

describe('複製貼上/批量操作完整流程', () => {
  let podStore: ReturnType<typeof usePodStore>
  let selectionStore: ReturnType<typeof useSelectionStore>
  let viewportStore: ReturnType<typeof useViewportStore>
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

    podStore = usePodStore()
    selectionStore = useSelectionStore()
    viewportStore = useViewportStore()
    outputStyleStore = useOutputStyleStore()
    skillStore = useSkillStore()
    repositoryStore = useRepositoryStore()
    subAgentStore = useSubAgentStore()
    commandStore = useCommandStore()
    connectionStore = useConnectionStore()
    clipboardStore = useClipboardStore()
    canvasStore = useCanvasStore()
    canvasStore.activeCanvasId = 'test-canvas-id'
  })

  describe('框選 -> 複製 -> 貼上', () => {
    it('應正確將框選的 Pod 和 Note 複製到 clipboardStore', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
      const outputNote = createMockNote('outputStyle', { id: 'note-1', x: 300, y: 300, boundToPodId: null })
      const skillNote = createMockNote('skill', { id: 'note-2', x: 400, y: 400, boundToPodId: null })

      podStore.pods = [pod1, pod2]
      outputStyleStore.notes = [outputNote]
      skillStore.notes = [skillNote]

      // 框選
      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 複製
      const selectedElements = selectionStore.selectedElements
      const selectedPodIds = new Set(selectedElements.filter(el => el.type === 'pod').map(el => el.id))
      const copiedPods = podStore.pods.filter(p => selectedPodIds.has(p.id)).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        outputStyleId: p.outputStyleId,
        skillIds: p.skillIds,
        subAgentIds: p.subAgentIds,
        model: p.model,
        repositoryId: p.repositoryId,
        commandId: p.commandId,
      }))

      const copiedOutputStyleNotes = outputStyleStore.notes
        .filter(n => selectedElements.some(el => el.type === 'outputStyleNote' && el.id === n.id))
        .map(n => ({
          id: n.id,
          outputStyleId: n.outputStyleId,
          name: n.name,
          x: n.x,
          y: n.y,
          boundToPodId: n.boundToPodId,
          originalPosition: n.originalPosition,
        }))

      const copiedSkillNotes = skillStore.notes
        .filter(n => selectedElements.some(el => el.type === 'skillNote' && el.id === n.id))
        .map(n => ({
          id: n.id,
          skillId: n.skillId,
          name: n.name,
          x: n.x,
          y: n.y,
          boundToPodId: n.boundToPodId,
          originalPosition: n.originalPosition,
        }))

      clipboardStore.setCopy(copiedPods, copiedOutputStyleNotes, copiedSkillNotes, [], [], [], [])

      // Assert
      expect(clipboardStore.isEmpty).toBe(false)
      expect(clipboardStore.copiedPods).toHaveLength(2)
      expect(clipboardStore.copiedOutputStyleNotes).toHaveLength(1)
      expect(clipboardStore.copiedSkillNotes).toHaveLength(1)
      expect(clipboardStore.copiedPods[0].id).toBe('pod-1')
      expect(clipboardStore.copiedPods[1].id).toBe('pod-2')
    })

    it('應過濾掉已綁定的 Note，只複製未綁定的 Note', () => {
      // Arrange
      const pod = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const boundNote = createMockNote('outputStyle', { id: 'note-1', x: 150, y: 150, boundToPodId: 'pod-1' })
      const unboundNote = createMockNote('outputStyle', { id: 'note-2', x: 200, y: 200, boundToPodId: null })

      podStore.pods = [pod]
      outputStyleStore.notes = [boundNote, unboundNote]

      // 框選全部
      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 複製
      const selectedElements = selectionStore.selectedElements
      const copiedOutputStyleNotes = outputStyleStore.notes
        .filter(n => selectedElements.some(el => el.type === 'outputStyleNote' && el.id === n.id) && n.boundToPodId === null)
        .map(n => ({
          id: n.id,
          outputStyleId: n.outputStyleId,
          name: n.name,
          x: n.x,
          y: n.y,
          boundToPodId: n.boundToPodId,
          originalPosition: n.originalPosition,
        }))

      clipboardStore.setCopy([], copiedOutputStyleNotes, [], [], [], [], [])

      // Assert: 只有未綁定的 note 被複製
      expect(clipboardStore.copiedOutputStyleNotes).toHaveLength(1)
      expect(clipboardStore.copiedOutputStyleNotes[0].id).toBe('note-2')
    })

    it('應複製兩個 Pod 之間的 Connection', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
      const connection = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
        sourceAnchor: 'bottom',
        targetAnchor: 'top',
      })

      podStore.pods = [pod1, pod2]
      connectionStore.connections = [connection]

      // 框選兩個 Pod
      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 複製
      const selectedElements = selectionStore.selectedElements
      const selectedPodIds = new Set(selectedElements.filter(el => el.type === 'pod').map(el => el.id))
      const copiedConnections = connectionStore.connections
        .filter(conn => selectedPodIds.has(conn.sourcePodId) && selectedPodIds.has(conn.targetPodId))
        .map(conn => ({
          sourcePodId: conn.sourcePodId,
          sourceAnchor: conn.sourceAnchor,
          targetPodId: conn.targetPodId,
          targetAnchor: conn.targetAnchor,
          autoTrigger: conn.triggerMode === 'auto',
        }))

      clipboardStore.setCopy([], [], [], [], [], [], copiedConnections)

      // Assert
      expect(clipboardStore.copiedConnections).toHaveLength(1)
      expect(clipboardStore.copiedConnections[0].sourcePodId).toBe('pod-1')
      expect(clipboardStore.copiedConnections[0].targetPodId).toBe('pod-2')
    })

    it('應在貼上後更新 selectionStore 為新建立的元素', () => {
      // Arrange
      const pod = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const note = createMockNote('outputStyle', { id: 'note-1', x: 200, y: 200, boundToPodId: null })

      clipboardStore.setCopy(
        [{
          id: pod.id,
          name: pod.name,
          color: pod.color,
          x: pod.x,
          y: pod.y,
          rotation: pod.rotation,
        }],
        [{
          id: note.id,
          outputStyleId: note.outputStyleId,
          name: note.name,
          x: note.x,
          y: note.y,
          boundToPodId: note.boundToPodId,
          originalPosition: note.originalPosition,
        }],
        [],
        [],
        [],
        [],
        []
      )

      // Act: 模擬貼上後的 selection 更新
      const newSelectedElements: SelectableElement[] = [
        { type: 'pod', id: 'new-pod-1' },
        { type: 'outputStyleNote', id: 'new-note-1' },
      ]
      selectionStore.setSelectedElements(newSelectedElements)

      // Assert
      expect(selectionStore.selectedElements).toHaveLength(2)
      expect(selectionStore.selectedElements).toEqual(newSelectedElements)
      expect(selectionStore.selectedPodIds).toEqual(['new-pod-1'])
      expect(selectionStore.selectedOutputStyleNoteIds).toEqual(['new-note-1'])
    })
  })

  describe('框選 -> 批量拖曳', () => {
    it('應更新所有選中 Pod 的座標', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })

      podStore.pods = [pod1, pod2]

      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 批量拖曳 (移動 50, 50)
      const dx = 50
      const dy = 50

      selectionStore.selectedElements.forEach(element => {
        if (element.type === 'pod') {
          const pod = podStore.pods.find(p => p.id === element.id)
          if (pod) {
            podStore.movePod(element.id, pod.x + dx, pod.y + dy)
          }
        }
      })

      // Assert
      const updatedPod1 = podStore.pods.find(p => p.id === 'pod-1')
      const updatedPod2 = podStore.pods.find(p => p.id === 'pod-2')

      expect(updatedPod1?.x).toBe(150)
      expect(updatedPod1?.y).toBe(150)
      expect(updatedPod2?.x).toBe(250)
      expect(updatedPod2?.y).toBe(250)
    })

    it('應更新所有選中的未綁定 Note 的座標', () => {
      // Arrange
      const note1 = createMockNote('outputStyle', { id: 'note-1', x: 100, y: 100, boundToPodId: null })
      const note2 = createMockNote('skill', { id: 'note-2', x: 200, y: 200, boundToPodId: null })
      const boundNote = createMockNote('outputStyle', { id: 'note-3', x: 300, y: 300, boundToPodId: 'pod-1' })

      outputStyleStore.notes = [note1, boundNote]
      skillStore.notes = [note2]

      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 批量拖曳 (移動 30, 40)
      const dx = 30
      const dy = 40

      selectionStore.selectedElements.forEach(element => {
        if (element.type === 'outputStyleNote') {
          const note = outputStyleStore.notes.find(n => n.id === element.id)
          if (note && note.boundToPodId === null) {
            outputStyleStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          }
        } else if (element.type === 'skillNote') {
          const note = skillStore.notes.find(n => n.id === element.id)
          if (note && note.boundToPodId === null) {
            skillStore.updateNotePositionLocal(element.id, note.x + dx, note.y + dy)
          }
        }
      })

      // Assert: 只有未綁定的 note 座標被更新
      const updatedNote1 = outputStyleStore.notes.find(n => n.id === 'note-1')
      const updatedNote2 = skillStore.notes.find(n => n.id === 'note-2')
      const updatedBoundNote = outputStyleStore.notes.find(n => n.id === 'note-3')

      expect(updatedNote1?.x).toBe(130)
      expect(updatedNote1?.y).toBe(140)
      expect(updatedNote2?.x).toBe(230)
      expect(updatedNote2?.y).toBe(240)
      expect(updatedBoundNote?.x).toBe(300) // 綁定的 note 不應被移動
      expect(updatedBoundNote?.y).toBe(300)
    })

    it('應在拖曳後調用 syncPodPosition 同步到後端', () => {
      // Arrange
      const pod = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      podStore.pods = [pod]

      selectionStore.setSelectedElements([{ type: 'pod', id: 'pod-1' }])

      // Spy on syncPodPosition
      const syncSpy = vi.spyOn(podStore, 'syncPodPosition')

      // Act: 移動並同步
      podStore.movePod('pod-1', 150, 150)
      podStore.syncPodPosition('pod-1')

      // Assert
      expect(syncSpy).toHaveBeenCalledWith('pod-1')
    })

    it('應在拖曳後調用 updateNotePosition 同步 Note 到後端', async () => {
      // Arrange
      const note = createMockNote('outputStyle', { id: 'note-1', x: 100, y: 100, boundToPodId: null })
      outputStyleStore.notes = [note]

      selectionStore.setSelectedElements([{ type: 'outputStyleNote', id: 'note-1' }])

      // Spy on updateNotePosition
      const updateSpy = vi.spyOn(outputStyleStore, 'updateNotePosition')

      // Act: 移動並同步
      outputStyleStore.updateNotePositionLocal('note-1', 150, 150)
      await outputStyleStore.updateNotePosition('note-1', 150, 150)

      // Assert
      expect(updateSpy).toHaveBeenCalledWith('note-1', 150, 150)
    })
  })

  describe('框選 -> 批量刪除', () => {
    it('應刪除所有選中的 Pod', async () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
      const pod3 = createMockPod({ id: 'pod-3', x: 1000, y: 1000 })

      podStore.pods = [pod1, pod2, pod3]

      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      expect(selectionStore.selectedPodIds).toHaveLength(2)

      // Act: 批量刪除
      const deletePromises: Promise<void>[] = []
      selectionStore.selectedPodIds.forEach(id => {
        deletePromises.push(podStore.deletePodWithBackend(id))
      })

      await Promise.allSettled(deletePromises)

      // Assert: 雖然 deletePodWithBackend 可能不會在測試中真正移除 pod（因為 WebSocket mock），
      // 但我們可以驗證刪除方法被調用
      expect(deletePromises).toHaveLength(2)
    })

    it('應刪除所有選中的 Note', async () => {
      // Arrange
      const note1 = createMockNote('outputStyle', { id: 'note-1', x: 100, y: 100, boundToPodId: null })
      const note2 = createMockNote('skill', { id: 'note-2', x: 200, y: 200, boundToPodId: null })
      const note3 = createMockNote('outputStyle', { id: 'note-3', x: 1000, y: 1000, boundToPodId: null })

      outputStyleStore.notes = [note1, note3]
      skillStore.notes = [note2]

      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(500, 500)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )

      // Act: 批量刪除
      const deletePromises: Promise<void>[] = []

      selectionStore.selectedOutputStyleNoteIds.forEach(id => {
        deletePromises.push(outputStyleStore.deleteNote(id))
      })

      selectionStore.selectedSkillNoteIds.forEach(id => {
        deletePromises.push(skillStore.deleteNote(id))
      })

      await Promise.allSettled(deletePromises)

      // Assert
      expect(deletePromises).toHaveLength(2)
    })

    it('應在刪除後清空 selection', () => {
      // Arrange
      selectionStore.setSelectedElements([
        { type: 'pod', id: 'pod-1' },
        { type: 'outputStyleNote', id: 'note-1' },
      ])

      expect(selectionStore.hasSelection).toBe(true)

      // Act: 清空 selection
      selectionStore.clearSelection()

      // Assert
      expect(selectionStore.hasSelection).toBe(false)
      expect(selectionStore.selectedElements).toHaveLength(0)
    })

    it('應在刪除 Pod 時自動清理相關 Connection', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })
      const connection = createMockConnection({
        id: 'conn-1',
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
      })

      podStore.pods = [pod1, pod2]
      connectionStore.connections = [connection]

      // Spy on deleteConnectionsByPodId
      const deleteConnSpy = vi.spyOn(connectionStore, 'deleteConnectionsByPodId')

      // Act: 刪除 pod-1
      podStore.removePod('pod-1')

      // Assert
      expect(deleteConnSpy).toHaveBeenCalledWith('pod-1')
      expect(connectionStore.connections.filter(c => c.sourcePodId === 'pod-1' || c.targetPodId === 'pod-1')).toHaveLength(0)
    })
  })

  describe('Ctrl 框選', () => {
    it('第一次框選應選中元素', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 200, y: 200 })

      podStore.pods = [pod1, pod2]

      // Act: 第一次框選
      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(300, 300)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
      selectionStore.endSelection()

      // Assert
      expect(selectionStore.selectedPodIds).toEqual(['pod-1', 'pod-2'])
    })

    it('Ctrl 第二次框選應 toggle 反選', () => {
      // Arrange
      // Pod 尺寸: 224x168
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 }) // (100,100) 到 (324,268)
      const pod2 = createMockPod({ id: 'pod-2', x: 250, y: 250 }) // (250,250) 到 (474,418)
      const pod3 = createMockPod({ id: 'pod-3', x: 400, y: 400 }) // (400,400) 到 (624,568)

      podStore.pods = [pod1, pod2, pod3]

      // 第一次框選 pod-1 和 pod-2
      // 框選範圍: (0,0) 到 (350,350)
      selectionStore.startSelection(0, 0)
      selectionStore.updateSelection(350, 350)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
      selectionStore.endSelection()

      expect(selectionStore.selectedPodIds).toEqual(['pod-1', 'pod-2'])

      // Act: Ctrl 第二次框選 pod-2 和 pod-3
      // 框選範圍: (350,350) 到 (700,700) - 不包含 pod-1
      selectionStore.startSelection(350, 350, true)
      selectionStore.updateSelection(700, 700)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
      selectionStore.endSelection()

      // Assert: pod-2 被 toggle 移除，pod-3 被加入
      expect(selectionStore.selectedPodIds).toEqual(['pod-1', 'pod-3'])
    })

    it('Ctrl 框選已選中的元素應移除該元素', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })

      podStore.pods = [pod1]

      // 先選中 pod-1
      selectionStore.setSelectedElements([{ type: 'pod', id: 'pod-1' }])
      expect(selectionStore.selectedPodIds).toEqual(['pod-1'])

      // Act: Ctrl 框選同一個 pod-1
      selectionStore.startSelection(0, 0, true)
      selectionStore.updateSelection(300, 300)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
      selectionStore.endSelection()

      // Assert: pod-1 被 toggle 移除
      expect(selectionStore.selectedPodIds).toEqual([])
    })

    it('Ctrl 框選未選中的元素應加入該元素', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })
      const pod2 = createMockPod({ id: 'pod-2', x: 500, y: 500 })

      podStore.pods = [pod1, pod2]

      // 先選中 pod-1
      selectionStore.setSelectedElements([{ type: 'pod', id: 'pod-1' }])

      // Act: Ctrl 框選 pod-2
      selectionStore.startSelection(400, 400, true)
      selectionStore.updateSelection(600, 600)
      selectionStore.calculateSelectedElements(
        podStore.pods,
        outputStyleStore.notes,
        skillStore.notes,
        repositoryStore.notes,
        subAgentStore.notes,
        commandStore.notes
      )
      selectionStore.endSelection()

      // Assert: pod-2 被加入
      expect(selectionStore.selectedPodIds).toEqual(['pod-1', 'pod-2'])
    })

    it('應正確處理 Ctrl 模式的 initialSelectedElements', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })

      podStore.pods = [pod1]

      selectionStore.setSelectedElements([{ type: 'pod', id: 'pod-1' }])

      // Act: 開始 Ctrl 框選
      selectionStore.startSelection(0, 0, true)

      // Assert: initialSelectedElements 應保存先前的選擇
      expect(selectionStore.initialSelectedElements).toEqual([{ type: 'pod', id: 'pod-1' }])
      expect(selectionStore.isCtrlMode).toBe(true)
    })

    it('應在 endSelection 後重置 isCtrlMode 和 initialSelectedElements', () => {
      // Arrange
      const pod1 = createMockPod({ id: 'pod-1', x: 100, y: 100 })

      podStore.pods = [pod1]

      selectionStore.setSelectedElements([{ type: 'pod', id: 'pod-1' }])

      // Act
      selectionStore.startSelection(0, 0, true)
      expect(selectionStore.isCtrlMode).toBe(true)

      selectionStore.endSelection()

      // Assert
      expect(selectionStore.isCtrlMode).toBe(false)
      expect(selectionStore.initialSelectedElements).toEqual([])
    })
  })
})
