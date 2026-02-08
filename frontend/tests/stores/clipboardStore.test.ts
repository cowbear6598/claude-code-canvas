import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../helpers/mockStoreFactory'
import { useClipboardStore } from '@/stores/clipboardStore'
import type {
  CopiedPod,
  CopiedOutputStyleNote,
  CopiedSkillNote,
  CopiedRepositoryNote,
  CopiedSubAgentNote,
  CopiedCommandNote,
  CopiedConnection,
} from '@/types'

describe('clipboardStore', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  describe('初始狀態', () => {
    it('所有 copied 陣列應為空', () => {
      const store = useClipboardStore()

      expect(store.copiedPods).toEqual([])
      expect(store.copiedOutputStyleNotes).toEqual([])
      expect(store.copiedSkillNotes).toEqual([])
      expect(store.copiedRepositoryNotes).toEqual([])
      expect(store.copiedSubAgentNotes).toEqual([])
      expect(store.copiedCommandNotes).toEqual([])
      expect(store.copiedConnections).toEqual([])
    })

    it('copyTimestamp 應為 null', () => {
      const store = useClipboardStore()

      expect(store.copyTimestamp).toBeNull()
    })
  })

  describe('isEmpty getter', () => {
    it('全空時應為 true', () => {
      const store = useClipboardStore()

      expect(store.isEmpty).toBe(true)
    })

    it('有 copiedPods 時應為 false', () => {
      const store = useClipboardStore()
      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      store.setCopy([mockPod], [], [], [], [], [], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedOutputStyleNotes 時應為 false', () => {
      const store = useClipboardStore()
      const mockNote: CopiedOutputStyleNote = {
        id: 'note-1',
        outputStyleId: 'style-1',
        name: 'Test Style',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }

      store.setCopy([], [mockNote], [], [], [], [], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedSkillNotes 時應為 false', () => {
      const store = useClipboardStore()
      const mockNote: CopiedSkillNote = {
        id: 'note-1',
        skillId: 'skill-1',
        name: 'Test Skill',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }

      store.setCopy([], [], [mockNote], [], [], [], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedRepositoryNotes 時應為 false', () => {
      const store = useClipboardStore()
      const mockNote: CopiedRepositoryNote = {
        repositoryId: 'repo-1',
        name: 'Test Repository',
        x: 100,
        y: 200,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      store.setCopy([], [], [], [mockNote], [], [], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedSubAgentNotes 時應為 false', () => {
      const store = useClipboardStore()
      const mockNote: CopiedSubAgentNote = {
        id: 'note-1',
        subAgentId: 'sub-agent-1',
        name: 'Test SubAgent',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }

      store.setCopy([], [], [], [], [mockNote], [], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedCommandNotes 時應為 false', () => {
      const store = useClipboardStore()
      const mockNote: CopiedCommandNote = {
        commandId: 'command-1',
        name: 'Test Command',
        x: 100,
        y: 200,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      store.setCopy([], [], [], [], [], [mockNote], [])

      expect(store.isEmpty).toBe(false)
    })

    it('有 copiedConnections 時應為 false', () => {
      const store = useClipboardStore()
      const mockConnection: CopiedConnection = {
        sourcePodId: 'pod-1',
        sourceAnchor: 'bottom',
        targetPodId: 'pod-2',
        targetAnchor: 'top',
      }

      store.setCopy([], [], [], [], [], [], [mockConnection])

      expect(store.isEmpty).toBe(false)
    })

    it('有多種類型的資料時應為 false', () => {
      const store = useClipboardStore()
      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }
      const mockConnection: CopiedConnection = {
        sourcePodId: 'pod-1',
        sourceAnchor: 'bottom',
        targetPodId: 'pod-2',
        targetAnchor: 'top',
      }

      store.setCopy([mockPod], [], [], [], [], [], [mockConnection])

      expect(store.isEmpty).toBe(false)
    })
  })

  describe('setCopy', () => {
    it('應設定所有 7 個陣列', () => {
      const store = useClipboardStore()

      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      const mockOutputStyleNote: CopiedOutputStyleNote = {
        id: 'note-1',
        outputStyleId: 'style-1',
        name: 'Test Style',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockSkillNote: CopiedSkillNote = {
        id: 'note-2',
        skillId: 'skill-1',
        name: 'Test Skill',
        x: 150,
        y: 250,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockRepositoryNote: CopiedRepositoryNote = {
        repositoryId: 'repo-1',
        name: 'Test Repository',
        x: 200,
        y: 300,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      const mockSubAgentNote: CopiedSubAgentNote = {
        id: 'note-3',
        subAgentId: 'sub-agent-1',
        name: 'Test SubAgent',
        x: 250,
        y: 350,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockCommandNote: CopiedCommandNote = {
        commandId: 'command-1',
        name: 'Test Command',
        x: 300,
        y: 400,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      const mockConnection: CopiedConnection = {
        sourcePodId: 'pod-1',
        sourceAnchor: 'bottom',
        targetPodId: 'pod-2',
        targetAnchor: 'top',
      }

      store.setCopy(
        [mockPod],
        [mockOutputStyleNote],
        [mockSkillNote],
        [mockRepositoryNote],
        [mockSubAgentNote],
        [mockCommandNote],
        [mockConnection]
      )

      expect(store.copiedPods).toEqual([mockPod])
      expect(store.copiedOutputStyleNotes).toEqual([mockOutputStyleNote])
      expect(store.copiedSkillNotes).toEqual([mockSkillNote])
      expect(store.copiedRepositoryNotes).toEqual([mockRepositoryNote])
      expect(store.copiedSubAgentNotes).toEqual([mockSubAgentNote])
      expect(store.copiedCommandNotes).toEqual([mockCommandNote])
      expect(store.copiedConnections).toEqual([mockConnection])
    })

    it('應設定 copyTimestamp 為當前時間', () => {
      const store = useClipboardStore()
      const mockTimestamp = 1234567890
      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp)

      store.setCopy([], [], [], [], [], [], [])

      expect(store.copyTimestamp).toBe(mockTimestamp)
    })

    it('應能設定空陣列', () => {
      const store = useClipboardStore()

      store.setCopy([], [], [], [], [], [], [])

      expect(store.copiedPods).toEqual([])
      expect(store.copiedOutputStyleNotes).toEqual([])
      expect(store.copiedSkillNotes).toEqual([])
      expect(store.copiedRepositoryNotes).toEqual([])
      expect(store.copiedSubAgentNotes).toEqual([])
      expect(store.copiedCommandNotes).toEqual([])
      expect(store.copiedConnections).toEqual([])
      expect(store.copyTimestamp).toBeTruthy()
    })

    it('應能覆蓋之前的資料', () => {
      const store = useClipboardStore()

      const mockPod1: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod 1',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      const mockPod2: CopiedPod = {
        id: 'pod-2',
        name: 'Test Pod 2',
        color: 'coral',
        x: 300,
        y: 400,
        rotation: 45,
      }

      store.setCopy([mockPod1], [], [], [], [], [], [])
      expect(store.copiedPods).toEqual([mockPod1])

      store.setCopy([mockPod2], [], [], [], [], [], [])
      expect(store.copiedPods).toEqual([mockPod2])
    })

    it('應能設定多個項目的陣列', () => {
      const store = useClipboardStore()

      const mockPods: CopiedPod[] = [
        {
          id: 'pod-1',
          name: 'Test Pod 1',
          color: 'blue',
          x: 100,
          y: 200,
          rotation: 0,
        },
        {
          id: 'pod-2',
          name: 'Test Pod 2',
          color: 'coral',
          x: 300,
          y: 400,
          rotation: 45,
        },
      ]

      store.setCopy(mockPods, [], [], [], [], [], [])

      expect(store.copiedPods).toHaveLength(2)
      expect(store.copiedPods).toEqual(mockPods)
    })
  })

  describe('clear', () => {
    it('應清空所有陣列', () => {
      const store = useClipboardStore()

      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      store.setCopy([mockPod], [], [], [], [], [], [])
      expect(store.copiedPods).toHaveLength(1)

      store.clear()

      expect(store.copiedPods).toEqual([])
      expect(store.copiedOutputStyleNotes).toEqual([])
      expect(store.copiedSkillNotes).toEqual([])
      expect(store.copiedRepositoryNotes).toEqual([])
      expect(store.copiedSubAgentNotes).toEqual([])
      expect(store.copiedCommandNotes).toEqual([])
      expect(store.copiedConnections).toEqual([])
    })

    it('應清空 timestamp', () => {
      const store = useClipboardStore()

      store.setCopy([], [], [], [], [], [], [])
      expect(store.copyTimestamp).toBeTruthy()

      store.clear()

      expect(store.copyTimestamp).toBeNull()
    })

    it('應使 isEmpty 回傳 true', () => {
      const store = useClipboardStore()

      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      store.setCopy([mockPod], [], [], [], [], [], [])
      expect(store.isEmpty).toBe(false)

      store.clear()

      expect(store.isEmpty).toBe(true)
    })
  })

  describe('getCopiedData', () => {
    it('應回傳所有 7 個陣列的資料', () => {
      const store = useClipboardStore()

      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      const mockOutputStyleNote: CopiedOutputStyleNote = {
        id: 'note-1',
        outputStyleId: 'style-1',
        name: 'Test Style',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockSkillNote: CopiedSkillNote = {
        id: 'note-2',
        skillId: 'skill-1',
        name: 'Test Skill',
        x: 150,
        y: 250,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockRepositoryNote: CopiedRepositoryNote = {
        repositoryId: 'repo-1',
        name: 'Test Repository',
        x: 200,
        y: 300,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      const mockSubAgentNote: CopiedSubAgentNote = {
        id: 'note-3',
        subAgentId: 'sub-agent-1',
        name: 'Test SubAgent',
        x: 250,
        y: 350,
        boundToPodId: null,
        originalPosition: null,
      }

      const mockCommandNote: CopiedCommandNote = {
        commandId: 'command-1',
        name: 'Test Command',
        x: 300,
        y: 400,
        boundToOriginalPodId: null,
        originalPosition: null,
      }

      const mockConnection: CopiedConnection = {
        sourcePodId: 'pod-1',
        sourceAnchor: 'bottom',
        targetPodId: 'pod-2',
        targetAnchor: 'top',
      }

      store.setCopy(
        [mockPod],
        [mockOutputStyleNote],
        [mockSkillNote],
        [mockRepositoryNote],
        [mockSubAgentNote],
        [mockCommandNote],
        [mockConnection]
      )

      const result = store.getCopiedData()

      expect(result).toEqual({
        pods: [mockPod],
        outputStyleNotes: [mockOutputStyleNote],
        skillNotes: [mockSkillNote],
        repositoryNotes: [mockRepositoryNote],
        subAgentNotes: [mockSubAgentNote],
        commandNotes: [mockCommandNote],
        connections: [mockConnection],
      })
    })

    it('應回傳空陣列當沒有資料時', () => {
      const store = useClipboardStore()

      const result = store.getCopiedData()

      expect(result).toEqual({
        pods: [],
        outputStyleNotes: [],
        skillNotes: [],
        repositoryNotes: [],
        subAgentNotes: [],
        commandNotes: [],
        connections: [],
      })
    })

    it('應回傳當前 store 狀態的快照', () => {
      const store = useClipboardStore()

      const mockPod: CopiedPod = {
        id: 'pod-1',
        name: 'Test Pod',
        color: 'blue',
        x: 100,
        y: 200,
        rotation: 0,
      }

      store.setCopy([mockPod], [], [], [], [], [], [])

      const result1 = store.getCopiedData()
      expect(result1.pods).toHaveLength(1)

      store.clear()

      const result2 = store.getCopiedData()
      expect(result2.pods).toHaveLength(0)
    })
  })
})
