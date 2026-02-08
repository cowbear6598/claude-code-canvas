import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateUUID, generateRequestId } from '@/services/utils'

describe('services/utils', () => {
  describe('generateUUID', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('產生符合 UUID 格式的字串', () => {
      vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('a1b2c3d4-e5f6-4789-8abc-def012345678')

      const uuid = generateUUID()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(uuid).toMatch(uuidRegex)
    })

    it('多次呼叫產生不同的 UUID', () => {
      vi.spyOn(global.crypto, 'randomUUID')
        .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
        .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')

      const uuid1 = generateUUID()
      const uuid2 = generateUUID()

      expect(uuid1).not.toBe(uuid2)
    })

    it('使用 crypto.randomUUID 當其可用時', () => {
      const mockRandomUUID = vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('12345678-1234-4234-8234-123456789012')

      const uuid = generateUUID()

      expect(mockRandomUUID).toHaveBeenCalled()
      expect(uuid).toBe('12345678-1234-4234-8234-123456789012')
    })

    it('當 crypto.randomUUID 不存在時使用 getRandomValues fallback', () => {
      const mockGetRandomValues = vi.fn((array: Uint8Array) => {
        array[0] = 15
        return array
      })

      vi.stubGlobal('crypto', {
        getRandomValues: mockGetRandomValues,
      })

      const uuid = generateUUID()

      expect(mockGetRandomValues).toHaveBeenCalled()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

      vi.unstubAllGlobals()
    })

    it('fallback 產生的 UUID 符合版本 4 格式', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint8Array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 16)
          }
          return array
        },
      })

      const uuid = generateUUID()
      const parts = uuid.split('-')

      expect(parts[2][0]).toBe('4')
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0])

      vi.unstubAllGlobals()
    })
  })

  describe('generateRequestId', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('呼叫 generateUUID', () => {
      vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('abcdef12-3456-4789-8abc-def012345678')

      const requestId = generateRequestId()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(requestId).toMatch(uuidRegex)
    })

    it('多次呼叫產生不同的 requestId', () => {
      vi.spyOn(global.crypto, 'randomUUID')
        .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
        .mockReturnValueOnce('44444444-4444-4444-8444-444444444444')

      const requestId1 = generateRequestId()
      const requestId2 = generateRequestId()

      expect(requestId1).not.toBe(requestId2)
    })
  })
})
