import { describe, it, expect } from 'vitest'
import { isCtrlOrCmdPressed } from '@/utils/keyboardHelpers'

describe('keyboardHelpers', () => {
  describe('isCtrlOrCmdPressed', () => {
    it('應該在 ctrlKey 為 true 時回傳 true', () => {
      const event = { ctrlKey: true, metaKey: false } as KeyboardEvent
      const result = isCtrlOrCmdPressed(event)
      expect(result).toBe(true)
    })

    it('應該在 metaKey 為 true 時回傳 true', () => {
      const event = { ctrlKey: false, metaKey: true } as KeyboardEvent
      const result = isCtrlOrCmdPressed(event)
      expect(result).toBe(true)
    })

    it('應該在兩者都為 false 時回傳 false', () => {
      const event = { ctrlKey: false, metaKey: false } as KeyboardEvent
      const result = isCtrlOrCmdPressed(event)
      expect(result).toBe(false)
    })

    it('應該在兩者都為 true 時回傳 true', () => {
      const event = { ctrlKey: true, metaKey: true } as KeyboardEvent
      const result = isCtrlOrCmdPressed(event)
      expect(result).toBe(true)
    })

    it('應該支援 MouseEvent', () => {
      const event = { ctrlKey: true, metaKey: false } as MouseEvent
      const result = isCtrlOrCmdPressed(event)
      expect(result).toBe(true)
    })
  })
})
