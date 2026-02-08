import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, mockCreateWebSocketRequest, resetMockWebSocket } from '../../helpers/mockWebSocket'
import type { Skill, SkillNote } from '@/types'

// Mock WebSocket
vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

// Mock createWebSocketRequest separately
vi.mock('@/services/websocket/createWebSocketRequest', () => ({
  createWebSocketRequest: mockCreateWebSocketRequest,
}))

// Mock useToast
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()
const mockToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
    toast: mockToast,
  }),
}))


describe('skillStore', () => {
  let useSkillStore: any
  let useCanvasStore: any

  beforeEach(async () => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()

    // Import stores after mocks are set up
    const skillStoreModule = await import('@/stores/note/skillStore')
    const canvasStoreModule = await import('@/stores/canvasStore')
    useSkillStore = skillStoreModule.useSkillStore
    useCanvasStore = canvasStoreModule.useCanvasStore
  })

  describe('deleteSkill', () => {
    it('應委派到 deleteItem', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const mockSkill: Skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'Test Description',
      }
      store.availableItems = [mockSkill]

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: true,
        deletedNoteIds: [],
      })

      await store.deleteSkill('skill-1')

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'skill:delete',
        responseEvent: 'skill:deleted',
        payload: {
          canvasId: 'canvas-1',
          skillId: 'skill-1',
        },
      })
      expect(mockShowSuccessToast).toHaveBeenCalledWith('Skill', '刪除成功', 'Test Skill')
      expect(store.availableItems).toHaveLength(0)
    })

    it('刪除 Skill 時應一併刪除關聯的 notes', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const mockSkill: Skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'Test Description',
      }
      const mockNote: SkillNote = {
        id: 'note-1',
        name: 'Test Skill',
        skillId: 'skill-1',
        x: 100,
        y: 200,
        boundToPodId: null,
        originalPosition: null,
      }
      store.availableItems = [mockSkill]
      store.notes = [mockNote]

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: true,
        deletedNoteIds: ['note-1'],
      })

      await store.deleteSkill('skill-1')

      expect(store.availableItems).toHaveLength(0)
      expect(store.notes).toHaveLength(0)
    })

    it('失敗時不會 throw（錯誤被 wrapWebSocketRequest 吃掉）', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const mockSkill: Skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'Test Description',
      }
      store.availableItems = [mockSkill]

      const error = new Error('刪除失敗')
      mockCreateWebSocketRequest.mockRejectedValueOnce(error)

      await expect(store.deleteSkill('skill-1')).resolves.not.toThrow()
    })
  })

  describe('loadSkills', () => {
    it('應委派到 loadItems', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const mockSkills: Skill[] = [
        {
          id: 'skill-1',
          name: 'Skill 1',
          description: 'Description 1',
        },
        {
          id: 'skill-2',
          name: 'Skill 2',
          description: 'Description 2',
        },
      ]

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        skills: mockSkills,
      })

      await store.loadSkills()

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith({
        requestEvent: 'skill:list',
        responseEvent: 'skill:list:result',
        payload: {
          canvasId: 'canvas-1',
        },
      })
      expect(store.availableItems).toEqual(mockSkills)
    })

    it('無 activeCanvasId 時應 early return', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const store = useSkillStore()

      await store.loadSkills()

      expect(mockCreateWebSocketRequest).not.toHaveBeenCalled()
      expect(store.availableItems).toEqual([])
    })

    it('載入失敗時應設定 error', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce(null)

      await store.loadSkills()

      expect(store.error).toBe('載入失敗')
    })
  })

  describe('importSkill', () => {
    it('成功時應回傳 success: true、skill 物件、isOverwrite 旗標', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const importedSkill: Skill = {
        id: 'skill-new',
        name: 'Imported Skill',
        description: 'Imported Description',
      }

      mockCreateWebSocketRequest
        .mockResolvedValueOnce({
          success: true,
          skill: importedSkill,
          isOverwrite: false,
        })
        .mockResolvedValueOnce({
          skills: [importedSkill],
        })

      const result = await store.importSkill('test-skill.md', 'file-data', 1024)

      expect(mockCreateWebSocketRequest).toHaveBeenNthCalledWith(1, {
        requestEvent: 'skill:import',
        responseEvent: 'skill:imported',
        payload: {
          canvasId: 'canvas-1',
          fileName: 'test-skill.md',
          fileData: 'file-data',
          fileSize: 1024,
        },
      })

      expect(mockCreateWebSocketRequest).toHaveBeenNthCalledWith(2, {
        requestEvent: 'skill:list',
        responseEvent: 'skill:list:result',
        payload: {
          canvasId: 'canvas-1',
        },
      })

      expect(result).toEqual({
        success: true,
        isOverwrite: false,
        skill: importedSkill,
      })

      expect(store.availableItems).toEqual([importedSkill])
    })

    it('覆蓋既有 Skill 時 isOverwrite 應為 true', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const importedSkill: Skill = {
        id: 'skill-existing',
        name: 'Existing Skill',
        description: 'Updated Description',
      }

      mockCreateWebSocketRequest
        .mockResolvedValueOnce({
          success: true,
          skill: importedSkill,
          isOverwrite: true,
        })
        .mockResolvedValueOnce({
          skills: [importedSkill],
        })

      const result = await store.importSkill('existing-skill.md', 'file-data', 2048)

      expect(result).toEqual({
        success: true,
        isOverwrite: true,
        skill: importedSkill,
      })
    })

    it('成功後應重新載入 skills', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      const importedSkill: Skill = {
        id: 'skill-1',
        name: 'New Skill',
        description: 'Description',
      }

      const existingSkill: Skill = {
        id: 'skill-2',
        name: 'Existing Skill',
        description: 'Existing Description',
      }

      mockCreateWebSocketRequest
        .mockResolvedValueOnce({
          success: true,
          skill: importedSkill,
          isOverwrite: false,
        })
        .mockResolvedValueOnce({
          skills: [existingSkill, importedSkill],
        })

      await store.importSkill('new-skill.md', 'file-data', 512)

      expect(mockCreateWebSocketRequest).toHaveBeenCalledTimes(2)
      expect(store.availableItems).toEqual([existingSkill, importedSkill])
    })

    it('後端回傳 success: false 時應回傳對應 error', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: false,
        error: '檔案格式不正確',
      })

      const result = await store.importSkill('invalid.txt', 'bad-data', 256)

      expect(result).toEqual({
        success: false,
        error: '檔案格式不正確',
      })

      expect(mockCreateWebSocketRequest).toHaveBeenCalledTimes(1)
    })

    it('回應無 success 欄位時應回傳預設錯誤訊息', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce(null)

      const result = await store.importSkill('test.md', 'data', 100)

      expect(result).toEqual({
        success: false,
        error: '匯入失敗',
      })
    })

    it('回應 success: false 且無 error 欄位時應回傳預設錯誤訊息', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useSkillStore()

      mockCreateWebSocketRequest.mockResolvedValueOnce({
        success: false,
      })

      const result = await store.importSkill('test.md', 'data', 100)

      expect(result).toEqual({
        success: false,
        error: '匯入失敗',
      })
    })
  })
})
