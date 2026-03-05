import { ref } from 'vue'
import type { Ref } from 'vue'
import type { McpServerConfig, Position } from '@/types'
import { screenToCanvasPosition } from '@/lib/canvasCoordinateUtils'

interface McpServerModalState {
  visible: boolean
  mode: 'create' | 'edit'
  mcpServerId: string
  initialName: string
  initialConfig: McpServerConfig | undefined
}

export interface McpServerOperations {
  updateMcpServer: (id: string, name: string, config: McpServerConfig) => Promise<{ success: boolean; [key: string]: unknown }>
  createMcpServer: (name: string, config: McpServerConfig) => Promise<{ success: boolean; mcpServer?: { id: string } }>
  createNote: (id: string, x: number, y: number) => Promise<void>
}

interface UseMcpServerModalOptions {
  viewportStore: { offset: { x: number; y: number }; zoom: number }
  lastMenuPosition: Ref<Position | null>
}

export function useMcpServerModal(options: UseMcpServerModalOptions): {
  mcpServerModal: Ref<McpServerModalState>
  handleOpenMcpServerModal: (mode: 'create' | 'edit', mcpServerId?: string) => void
  handleMcpServerModalSubmit: (payload: { name: string; config: McpServerConfig }, mcpServerStore: McpServerOperations) => Promise<void>
} {
  const { viewportStore, lastMenuPosition } = options

  const mcpServerModal = ref<McpServerModalState>({
    visible: false,
    mode: 'create',
    mcpServerId: '',
    initialName: '',
    initialConfig: undefined
  })

  function handleOpenMcpServerModal(mode: 'create' | 'edit', mcpServerId?: string): void {
    mcpServerModal.value = {
      visible: true,
      mode,
      mcpServerId: mcpServerId ?? '',
      initialName: '',
      initialConfig: undefined
    }
  }

  async function handleMcpServerModalSubmit(
    payload: { name: string; config: McpServerConfig },
    mcpServerStore: McpServerOperations
  ): Promise<void> {
    const { name, config } = payload
    const { mode, mcpServerId } = mcpServerModal.value

    if (mode === 'edit') {
      await mcpServerStore.updateMcpServer(mcpServerId, name, config)
      mcpServerModal.value.visible = false
      return
    }

    const result = await mcpServerStore.createMcpServer(name, config)

    if (!result.success || !lastMenuPosition.value) {
      mcpServerModal.value.visible = false
      return
    }

    if (result.mcpServer) {
      const position = screenToCanvasPosition(lastMenuPosition.value, viewportStore)
      await mcpServerStore.createNote(result.mcpServer.id, position.x, position.y)
    }

    mcpServerModal.value.visible = false
  }

  return {
    mcpServerModal,
    handleOpenMcpServerModal,
    handleMcpServerModalSubmit
  }
}
