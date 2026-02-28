import type { McpServer, McpServerNote, McpServerConfig } from '@/types'
import { createNoteStore } from './createNoteStore'
import type { NoteStoreContext } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useToast } from '@/composables/useToast'
import { requireActiveCanvas } from '@/utils/canvasGuard'
import type {
  McpServerCreatedPayload,
  McpServerUpdatedPayload,
  McpServerReadResultPayload,
} from '@/types/websocket'

interface McpServerStoreCustomActions {
  createMcpServer(name: string, config: McpServerConfig): Promise<{ success: boolean; mcpServer?: { id: string; name: string }; error?: string }>
  updateMcpServer(mcpServerId: string, name: string, config: McpServerConfig): Promise<{ success: boolean; mcpServer?: { id: string; name: string }; error?: string }>
  readMcpServer(mcpServerId: string): Promise<{ id: string; name: string; config: McpServerConfig } | null>
  deleteMcpServer(mcpServerId: string): Promise<void>
  loadMcpServers(): Promise<void>
}

const store = createNoteStore<McpServer, McpServerNote>({
  storeName: 'mcpServer',
  relationship: 'one-to-many',
  responseItemsKey: 'mcpServers',
  itemIdField: 'mcpServerId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.MCP_SERVER_LIST,
      response: WebSocketResponseEvents.MCP_SERVER_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.MCP_SERVER_NOTE_LIST,
      response: WebSocketResponseEvents.MCP_SERVER_NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.MCP_SERVER_NOTE_CREATE,
      response: WebSocketResponseEvents.MCP_SERVER_NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.MCP_SERVER_NOTE_UPDATE,
      response: WebSocketResponseEvents.MCP_SERVER_NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.MCP_SERVER_NOTE_DELETE,
      response: WebSocketResponseEvents.MCP_SERVER_NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_MCP_SERVER,
    response: WebSocketResponseEvents.POD_MCP_SERVER_BOUND,
  },
  unbindEvents: {
    request: WebSocketRequestEvents.POD_UNBIND_MCP_SERVER,
    response: WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.MCP_SERVER_DELETE,
    response: WebSocketResponseEvents.MCP_SERVER_DELETED,
  },
  createNotePayload: (item: McpServer) => ({
    mcpServerId: item.id,
  }),
  getItemId: (item: McpServer) => item.id,
  getItemName: (item: McpServer) => item.name,
  customActions: {
    async createMcpServer(this: NoteStoreContext<McpServer>, name: string, config: McpServerConfig): Promise<{ success: boolean; mcpServer?: { id: string; name: string }; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showSuccessToast, showErrorToast } = useToast()
      const canvasId = requireActiveCanvas()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: WebSocketRequestEvents.MCP_SERVER_CREATE,
          responseEvent: WebSocketResponseEvents.MCP_SERVER_CREATED,
          payload: { canvasId, name, config }
        })
      )

      if (!response) {
        showErrorToast('McpServer', '建立失敗', '建立 MCP Server 失敗')
        return { success: false, error: '建立 MCP Server 失敗' }
      }

      const payload = response as McpServerCreatedPayload
      if (!payload.mcpServer) {
        const error = payload.error || '建立 MCP Server 失敗'
        showErrorToast('McpServer', '建立失敗', error)
        return { success: false, error }
      }

      await this.loadItems()
      showSuccessToast('McpServer', '建立成功', name)
      return { success: true, mcpServer: payload.mcpServer }
    },

    async updateMcpServer(this: NoteStoreContext<McpServer>, mcpServerId: string, name: string, config: McpServerConfig): Promise<{ success: boolean; mcpServer?: { id: string; name: string }; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showSuccessToast, showErrorToast } = useToast()
      const canvasId = requireActiveCanvas()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: WebSocketRequestEvents.MCP_SERVER_UPDATE,
          responseEvent: WebSocketResponseEvents.MCP_SERVER_UPDATED,
          payload: { canvasId, mcpServerId, name, config }
        })
      )

      if (!response) {
        showErrorToast('McpServer', '更新失敗', '更新 MCP Server 失敗')
        return { success: false, error: '更新 MCP Server 失敗' }
      }

      const payload = response as McpServerUpdatedPayload
      if (!payload.mcpServer) {
        const error = payload.error || '更新 MCP Server 失敗'
        showErrorToast('McpServer', '更新失敗', error)
        return { success: false, error }
      }

      const index = this.availableItems.findIndex(item => item.id === mcpServerId)
      if (index !== -1) {
        this.availableItems[index] = { ...this.availableItems[index], ...payload.mcpServer } as McpServer
      }

      showSuccessToast('McpServer', '更新成功', payload.mcpServer.name)
      return { success: true, mcpServer: payload.mcpServer }
    },

    async readMcpServer(this: NoteStoreContext<McpServer>, mcpServerId: string): Promise<{ id: string; name: string; config: McpServerConfig } | null> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasId = requireActiveCanvas()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest({
          requestEvent: WebSocketRequestEvents.MCP_SERVER_READ,
          responseEvent: WebSocketResponseEvents.MCP_SERVER_READ_RESULT,
          payload: { canvasId, mcpServerId }
        })
      )

      if (!response) return null

      const payload = response as McpServerReadResultPayload
      return payload.mcpServer || null
    },

    async deleteMcpServer(this: NoteStoreContext<McpServer>, mcpServerId: string): Promise<void> {
      return this.deleteItem(mcpServerId)
    },

    async loadMcpServers(this: NoteStoreContext<McpServer>): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useMcpServerStore: (() => ReturnType<typeof store> & McpServerStoreCustomActions) & { $id: string } = store as (() => ReturnType<typeof store> & McpServerStoreCustomActions) & { $id: string }
