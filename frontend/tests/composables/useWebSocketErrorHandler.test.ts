import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'

// Mock functions
const { mockToast, mockSanitizeErrorForUser } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockSanitizeErrorForUser: vi.fn(),
}))

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock sanitizeErrorForUser
vi.mock('@/utils/errorSanitizer', () => ({
  sanitizeErrorForUser: mockSanitizeErrorForUser,
}))

describe('useWebSocketErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeErrorForUser.mockImplementation((error: unknown) => {
      if (error instanceof Error) return error.message
      if (typeof error === 'string') return error
      return '未知錯誤'
    })
  })

  describe('handleWebSocketError', () => {
    it('應呼叫 toast 顯示錯誤訊息（variant: destructive）', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()
      const error = new Error('測試錯誤')

      handleWebSocketError(error)

      expect(mockToast).toHaveBeenCalledWith({
        title: '操作失敗',
        description: '測試錯誤',
        variant: 'destructive',
      })
    })

    it('應使用 sanitizeErrorForUser 處理 error', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()
      const error = new Error('原始錯誤訊息')

      handleWebSocketError(error)

      expect(mockSanitizeErrorForUser).toHaveBeenCalledWith(error)
    })

    it('應使用預設 title「操作失敗」', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()

      handleWebSocketError(new Error('錯誤'))

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '操作失敗',
        })
      )
    })

    it('應允許自訂 title', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()

      handleWebSocketError(new Error('錯誤'), '自訂標題')

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '自訂標題',
        })
      )
    })

    it('應處理字串類型的 error', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()
      mockSanitizeErrorForUser.mockReturnValueOnce('字串錯誤訊息')

      handleWebSocketError('字串錯誤')

      expect(mockSanitizeErrorForUser).toHaveBeenCalledWith('字串錯誤')
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '字串錯誤訊息',
        })
      )
    })

    it('應處理 unknown 類型的 error', () => {
      const { handleWebSocketError } = useWebSocketErrorHandler()
      const unknownError = { some: 'object' }
      mockSanitizeErrorForUser.mockReturnValueOnce('未知錯誤')

      handleWebSocketError(unknownError)

      expect(mockSanitizeErrorForUser).toHaveBeenCalledWith(unknownError)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '未知錯誤',
        })
      )
    })
  })

  describe('wrapWebSocketRequest', () => {
    it('成功時應回傳 Promise 結果', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const successData = { id: '123', name: 'Test' }
      const promise = Promise.resolve(successData)

      const result = await wrapWebSocketRequest(promise)

      expect(result).toEqual(successData)
      expect(mockToast).not.toHaveBeenCalled()
    })

    it('失敗時應呼叫 handleWebSocketError', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const error = new Error('Request failed')
      const promise = Promise.reject(error)

      await wrapWebSocketRequest(promise)

      expect(mockSanitizeErrorForUser).toHaveBeenCalledWith(error)
      expect(mockToast).toHaveBeenCalledWith({
        title: '操作失敗',
        description: 'Request failed',
        variant: 'destructive',
      })
    })

    it('失敗時應回傳 null', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const error = new Error('Request failed')
      const promise = Promise.reject(error)

      const result = await wrapWebSocketRequest(promise)

      expect(result).toBeNull()
    })

    it('失敗時應允許自訂 errorTitle', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const error = new Error('Request failed')
      const promise = Promise.reject(error)

      await wrapWebSocketRequest(promise, '自訂錯誤標題')

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '自訂錯誤標題',
        })
      )
    })

    it('應支援泛型回傳型別（字串）', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const promise = Promise.resolve('string result')

      const result = await wrapWebSocketRequest<string>(promise)

      expect(result).toBe('string result')
    })

    it('應支援泛型回傳型別（數字）', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const promise = Promise.resolve(42)

      const result = await wrapWebSocketRequest<number>(promise)

      expect(result).toBe(42)
    })

    it('應支援泛型回傳型別（複雜物件）', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      interface TestData {
        id: string
        count: number
        nested: { value: boolean }
      }
      const testData: TestData = {
        id: 'test-123',
        count: 10,
        nested: { value: true },
      }
      const promise = Promise.resolve(testData)

      const result = await wrapWebSocketRequest<TestData>(promise)

      expect(result).toEqual(testData)
    })

    it('失敗後不應 throw error（應回傳 null）', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const promise = Promise.reject(new Error('Test error'))

      await expect(wrapWebSocketRequest(promise)).resolves.toBeNull()
    })

    it('應正確處理 async function 作為輸入', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const asyncFunc = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { result: 'async success' }
      }

      const result = await wrapWebSocketRequest(asyncFunc())

      expect(result).toEqual({ result: 'async success' })
    })

    it('應正確處理 async function 拋出的錯誤', async () => {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const asyncFunc = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        throw new Error('Async error')
      }

      const result = await wrapWebSocketRequest(asyncFunc())

      expect(result).toBeNull()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Async error',
        })
      )
    })
  })
})
