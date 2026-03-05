import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useMcpServerModal } from '@/composables/canvas/useMcpServerModal'

describe('useMcpServerModal', () => {
  const mockViewportStore = {
    offset: { x: 0, y: 0 },
    zoom: 1
  }

  let mockMcpServerStore: {
    updateMcpServer: ReturnType<typeof vi.fn>
    createMcpServer: ReturnType<typeof vi.fn>
    createNote: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockMcpServerStore = {
      updateMcpServer: vi.fn().mockResolvedValue(undefined),
      createMcpServer: vi.fn().mockResolvedValue({ success: true, mcpServer: { id: 'mcp-new' } }),
      createNote: vi.fn().mockResolvedValue(undefined)
    }
  })

  function createComposable(menuPosition = { x: 100, y: 200 }) {
    const lastMenuPosition = ref<{ x: number; y: number } | null>(menuPosition)
    return {
      composable: useMcpServerModal({ viewportStore: mockViewportStore, lastMenuPosition }),
      lastMenuPosition
    }
  }

  describe('handleOpenMcpServerModal - 開啟 McpServer Modal', () => {
    it('建立模式應設定 visible 為 true 且 mode 為 create', () => {
      const { composable } = createComposable()
      composable.handleOpenMcpServerModal('create')

      expect(composable.mcpServerModal.value.visible).toBe(true)
      expect(composable.mcpServerModal.value.mode).toBe('create')
      expect(composable.mcpServerModal.value.mcpServerId).toBe('')
    })

    it('編輯模式應設定 mcpServerId', () => {
      const { composable } = createComposable()
      composable.handleOpenMcpServerModal('edit', 'mcp-1')

      expect(composable.mcpServerModal.value.mode).toBe('edit')
      expect(composable.mcpServerModal.value.mcpServerId).toBe('mcp-1')
    })

    it('開啟後 initialName 應為空字串', () => {
      const { composable } = createComposable()
      composable.handleOpenMcpServerModal('create')

      expect(composable.mcpServerModal.value.initialName).toBe('')
      expect(composable.mcpServerModal.value.initialConfig).toBeUndefined()
    })
  })

  describe('handleMcpServerModalSubmit - McpServer 提交', () => {
    it('edit mode 應呼叫 updateMcpServer 並關閉 Modal', async () => {
      const { composable } = createComposable()
      composable.handleOpenMcpServerModal('edit', 'mcp-1')

      const config = { command: 'npx', args: ['-y', 'server'] }
      await composable.handleMcpServerModalSubmit({ name: 'My MCP', config }, mockMcpServerStore as any)

      expect(mockMcpServerStore.updateMcpServer).toHaveBeenCalledWith('mcp-1', 'My MCP', config)
      expect(composable.mcpServerModal.value.visible).toBe(false)
    })

    it('create mode 應呼叫 createMcpServer 並建立 Note', async () => {
      const { composable } = createComposable({ x: 50, y: 100 })
      composable.handleOpenMcpServerModal('create')

      const config = { command: 'npx', args: [] }
      await composable.handleMcpServerModalSubmit({ name: 'New MCP', config }, mockMcpServerStore as any)

      expect(mockMcpServerStore.createMcpServer).toHaveBeenCalledWith('New MCP', config)
      expect(mockMcpServerStore.createNote).toHaveBeenCalledWith('mcp-new', 50, 100)
      expect(composable.mcpServerModal.value.visible).toBe(false)
    })

    it('建立失敗時應關閉 Modal 但不建立 Note', async () => {
      const { composable } = createComposable()
      mockMcpServerStore.createMcpServer.mockResolvedValue({ success: false })
      composable.handleOpenMcpServerModal('create')

      const config = { command: 'npx', args: [] }
      await composable.handleMcpServerModalSubmit({ name: 'New MCP', config }, mockMcpServerStore as any)

      expect(mockMcpServerStore.createNote).not.toHaveBeenCalled()
      expect(composable.mcpServerModal.value.visible).toBe(false)
    })

    it('沒有 lastMenuPosition 時 create mode 不應建立 Note', async () => {
      const { composable, lastMenuPosition } = createComposable()
      lastMenuPosition.value = null
      composable.handleOpenMcpServerModal('create')

      const config = { command: 'npx', args: [] }
      await composable.handleMcpServerModalSubmit({ name: 'New MCP', config }, mockMcpServerStore as any)

      expect(mockMcpServerStore.createMcpServer).toHaveBeenCalled()
      expect(mockMcpServerStore.createNote).not.toHaveBeenCalled()
    })
  })
})
