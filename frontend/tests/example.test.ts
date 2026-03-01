import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import {
  setupTestPinia,
  createMockCanvas,
  createMockPod,
  createMockConnection,
  createMockMessage,
  mockWebSocketModule,
  resetMockWebSocket,
} from './helpers'

// Mock WebSocket 模組
vi.mock('@/services/websocket', () => mockWebSocketModule())

describe('測試工具範例', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
  })

  describe('測試資料工廠', () => {
    it('應該建立 Mock Canvas', () => {
      const canvas = createMockCanvas({ name: '測試畫布' })

      expect(canvas.id).toBe('canvas-1')
      expect(canvas.name).toBe('測試畫布')
      expect(canvas.sortIndex).toBe(1)
    })

    it('應該建立 Mock Pod', () => {
      const pod = createMockPod({ name: '測試 Pod' })

      expect(pod.id).toBe('pod-1')
      expect(pod.name).toBe('測試 Pod')
      expect(pod.output).toEqual([])
    })

    it('應該建立 Mock Connection', () => {
      const connection = createMockConnection({
        sourcePodId: 'pod-1',
        targetPodId: 'pod-2',
      })

      expect(connection.id).toBe('connection-1')
      expect(connection.sourcePodId).toBe('pod-1')
      expect(connection.targetPodId).toBe('pod-2')
    })

    it('應該建立 Mock Message', () => {
      const message = createMockMessage({
        role: 'assistant',
        content: '測試訊息',
      })

      expect(message.id).toBe('message-1')
      expect(message.role).toBe('assistant')
      expect(message.content).toBe('測試訊息')
    })
  })

  describe('WebSocket Mock', () => {
    it('應該可以 mock createWebSocketRequest', async () => {
      const { mockCreateWebSocketRequest } = await import('./helpers/mockWebSocket')

      mockCreateWebSocketRequest.mockResolvedValue({ success: true, data: 'test' })

      const result = await mockCreateWebSocketRequest({ test: 'data' })
      expect(result).toEqual({ success: true, data: 'test' })
    })
  })
})
