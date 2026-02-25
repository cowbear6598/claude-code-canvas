import { defineStore } from 'pinia'
import type { CursorMovedPayload } from '@/types/websocket'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const DEFAULT_CURSOR_COLOR = '#999999'

export interface RemoteCursor {
  connectionId: string
  x: number
  y: number
  color: string
}

interface CursorState {
  cursors: Map<string, RemoteCursor>
}

export const useCursorStore = defineStore('cursor', {
  state: (): CursorState => ({
    cursors: new Map(),
  }),

  getters: {
    cursorCount: (state): number => state.cursors.size,
  },

  actions: {
    addOrUpdateCursor(payload: CursorMovedPayload): void {
      const safeColor = HEX_COLOR_REGEX.test(payload.color) ? payload.color : DEFAULT_CURSOR_COLOR
      this.cursors.set(payload.connectionId, {
        connectionId: payload.connectionId,
        x: payload.x,
        y: payload.y,
        color: safeColor,
      })
    },

    removeCursor(connectionId: string): void {
      this.cursors.delete(connectionId)
    },

    clearAllCursors(): void {
      this.cursors.clear()
    },
  },
})
