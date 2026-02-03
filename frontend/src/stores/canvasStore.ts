import {defineStore} from 'pinia'
import {
  createWebSocketRequest,
  WebSocketRequestEvents,
  WebSocketResponseEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
import type {
  Canvas,
  CanvasCreatePayload,
  CanvasCreatedPayload,
  CanvasListPayload,
  CanvasListResultPayload,
  CanvasRenamePayload,
  CanvasRenamedPayload,
  CanvasDeletePayload,
  CanvasDeletedPayload,
  CanvasSwitchPayload,
  CanvasSwitchedPayload
} from '@/types/canvas'

interface CanvasState {
  canvases: Canvas[]
  activeCanvasId: string | null
  isSidebarOpen: boolean
  isLoading: boolean
}

export const useCanvasStore = defineStore('canvas', {
  state: (): CanvasState => ({
    canvases: [],
    activeCanvasId: null,
    isSidebarOpen: false,
    isLoading: false,
  }),

  getters: {
    activeCanvas: (state): Canvas | null => {
      if (!state.activeCanvasId) return null
      return state.canvases.find(c => c.id === state.activeCanvasId) || null
    },
  },

  actions: {
    toggleSidebar(): void {
      this.isSidebarOpen = !this.isSidebarOpen
    },

    setSidebarOpen(open: boolean): void {
      this.isSidebarOpen = open
    },

    async loadCanvases(): Promise<void> {
      this.isLoading = true

      try {
        const response = await createWebSocketRequest<CanvasListPayload, CanvasListResultPayload>({
          requestEvent: WebSocketRequestEvents.CANVAS_LIST,
          responseEvent: WebSocketResponseEvents.CANVAS_LIST_RESULT,
          payload: {}
        })

        if (response.canvases) {
          this.canvases = response.canvases
          if (this.canvases.length > 0 && !this.activeCanvasId) {
            const firstCanvasId = this.canvases[0].id
            // Notify backend which canvas is active
            await createWebSocketRequest<CanvasSwitchPayload, CanvasSwitchedPayload>({
              requestEvent: WebSocketRequestEvents.CANVAS_SWITCH,
              responseEvent: WebSocketResponseEvents.CANVAS_SWITCHED,
              payload: { canvasId: firstCanvasId }
            })
            this.activeCanvasId = firstCanvasId
            console.log('[CanvasStore] Active canvas set to:', this.activeCanvasId)
          }
        } else {
          console.warn('[CanvasStore] No canvases returned from backend')
        }
      } catch (error) {
        console.error('[CanvasStore] Failed to load canvases:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async createCanvas(name: string): Promise<Canvas | null> {
      try {
        const response = await createWebSocketRequest<CanvasCreatePayload, CanvasCreatedPayload>({
          requestEvent: WebSocketRequestEvents.CANVAS_CREATE,
          responseEvent: WebSocketResponseEvents.CANVAS_CREATED,
          payload: {
            name,
          }
        })

        if (response.canvas) {
          this.canvases.push(response.canvas)
          // Notify backend which canvas is active
          await createWebSocketRequest<CanvasSwitchPayload, CanvasSwitchedPayload>({
            requestEvent: WebSocketRequestEvents.CANVAS_SWITCH,
            responseEvent: WebSocketResponseEvents.CANVAS_SWITCHED,
            payload: { canvasId: response.canvas.id }
          })
          this.activeCanvasId = response.canvas.id
          console.log('[CanvasStore] Canvas created and set as active:', this.activeCanvasId)
          return response.canvas
        }

        return null
      } catch (error) {
        const {toast} = useToast()
        const msg = error instanceof Error ? error.message : '建立 Canvas 失敗'
        toast({title: msg, variant: 'destructive'})
        return null
      }
    },

    async renameCanvas(canvasId: string, newName: string): Promise<void> {
      try {
        const response = await createWebSocketRequest<CanvasRenamePayload, CanvasRenamedPayload>({
          requestEvent: WebSocketRequestEvents.CANVAS_RENAME,
          responseEvent: WebSocketResponseEvents.CANVAS_RENAMED,
          payload: {
                      canvasId,
            newName,
          }
        })

        if (response.canvas) {
          const canvas = this.canvases.find(c => c.id === canvasId)
          if (canvas) {
            canvas.name = response.canvas.name
          }
        }
      } catch (error) {
        const {toast} = useToast()
        const msg = error instanceof Error ? error.message : '重新命名 Canvas 失敗'
        toast({title: msg, variant: 'destructive'})
      }
    },

    async deleteCanvas(canvasId: string): Promise<void> {
      // If deleting active canvas, switch to another one first
      if (this.activeCanvasId === canvasId) {
        const otherCanvas = this.canvases.find(c => c.id !== canvasId)
        if (otherCanvas) {
          await this.switchCanvas(otherCanvas.id)
        }
      }

      const response = await createWebSocketRequest<CanvasDeletePayload, CanvasDeletedPayload>({
        requestEvent: WebSocketRequestEvents.CANVAS_DELETE,
        responseEvent: WebSocketResponseEvents.CANVAS_DELETED,
        payload: {
                    canvasId,
        }
      })

      if (response.success && response.canvasId) {
        this.canvases = this.canvases.filter(c => c.id !== canvasId)
      }
    },

    async switchCanvas(canvasId: string): Promise<void> {
      if (this.activeCanvasId === canvasId) return

      const response = await createWebSocketRequest<CanvasSwitchPayload, CanvasSwitchedPayload>({
        requestEvent: WebSocketRequestEvents.CANVAS_SWITCH,
        responseEvent: WebSocketResponseEvents.CANVAS_SWITCHED,
        payload: {
                    canvasId,
        }
      })

      if (response.success && response.canvasId) {
        this.activeCanvasId = canvasId
      }
    },

    reset(): void {
      this.canvases = []
      this.activeCanvasId = null
      this.isSidebarOpen = false
      this.isLoading = false
    },

    renameCanvasFromBroadcast(canvasId: string, newName: string): void {
      const canvas = this.canvases.find(c => c.id === canvasId)
      if (canvas) {
        canvas.name = newName
      }
    },

    async removeCanvasFromBroadcast(canvasId: string): Promise<void> {
      this.canvases = this.canvases.filter(c => c.id !== canvasId)

      if (this.activeCanvasId === canvasId) {
        if (this.canvases.length > 0) {
          await this.switchCanvas(this.canvases[0].id)
        } else {
          const defaultCanvas = await this.createCanvas('Default')
          if (defaultCanvas) {
            await this.switchCanvas(defaultCanvas.id)
          }
        }
      }
    },
  },
})
