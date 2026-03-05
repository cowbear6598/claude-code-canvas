import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockCreateWebSocketRequest } from '../helpers/mockWebSocket'

vi.mock('@/services/websocket/createWebSocketRequest', () => ({
  createWebSocketRequest: mockCreateWebSocketRequest,
}))

describe('configApi', () => {
  let getConfig: typeof import('@/services/configApi').getConfig
  let updateConfig: typeof import('@/services/configApi').updateConfig

  beforeEach(async () => {
    mockCreateWebSocketRequest.mockReset()
    const module = await import('@/services/configApi')
    getConfig = module.getConfig
    updateConfig = module.updateConfig
  })

  describe('getConfig', () => {
    it('getConfig 應發送 config:get WebSocket 事件並回傳設定', async () => {
      const mockResult = {
        requestId: 'req-1',
        success: true,
        summaryModel: 'sonnet',
        aiDecideModel: 'haiku',
      }
      mockCreateWebSocketRequest.mockResolvedValueOnce(mockResult)

      const result = await getConfig()

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestEvent: 'config:get',
          responseEvent: 'config:get:result',
          payload: {},
        })
      )
      expect(result).toEqual(mockResult)
    })

    it('getConfig 請求失敗時應拋出錯誤', async () => {
      mockCreateWebSocketRequest.mockRejectedValueOnce(new Error('WebSocket 連線失敗'))

      await expect(getConfig()).rejects.toThrow('WebSocket 連線失敗')
    })
  })

  describe('updateConfig', () => {
    it('updateConfig 應發送 config:update WebSocket 事件並回傳結果', async () => {
      const mockResult = {
        requestId: 'req-2',
        success: true,
        summaryModel: 'opus',
        aiDecideModel: 'sonnet',
      }
      mockCreateWebSocketRequest.mockResolvedValueOnce(mockResult)

      const result = await updateConfig({ summaryModel: 'opus', aiDecideModel: 'sonnet' })

      expect(mockCreateWebSocketRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestEvent: 'config:update',
          responseEvent: 'config:updated',
          payload: { summaryModel: 'opus', aiDecideModel: 'sonnet' },
        })
      )
      expect(result).toEqual(mockResult)
    })

    it('updateConfig 請求失敗時應拋出錯誤', async () => {
      mockCreateWebSocketRequest.mockRejectedValueOnce(new Error('請求逾時'))

      await expect(updateConfig({ summaryModel: 'haiku', aiDecideModel: 'haiku' })).rejects.toThrow('請求逾時')
    })
  })
})
