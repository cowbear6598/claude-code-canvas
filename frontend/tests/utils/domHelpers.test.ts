import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isEditingElement, hasTextSelection, getPlatformModifierKey, isModifierKeyPressed } from '@/utils/domHelpers'

describe('domHelpers', () => {
  describe('isEditingElement', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('應該在 INPUT 元素獲得焦點時回傳 true', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const result = isEditingElement()
      expect(result).toBe(true)
    })

    it('應該在 TEXTAREA 元素獲得焦點時回傳 true', () => {
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      const result = isEditingElement()
      expect(result).toBe(true)
    })

    it('應該在 SELECT 元素獲得焦點時回傳 true', () => {
      const select = document.createElement('select')
      document.body.appendChild(select)
      select.focus()

      const result = isEditingElement()
      expect(result).toBe(true)
    })

    it('應該在 contenteditable 元素獲得焦點時回傳 true', () => {
      const div = document.createElement('div')
      div.setAttribute('contenteditable', 'true')
      document.body.appendChild(div)
      div.focus()

      const result = isEditingElement()
      expect(result).toBe(true)
    })

    it('應該在一般 DIV 獲得焦點時回傳 false', () => {
      const div = document.createElement('div')
      div.tabIndex = 0
      document.body.appendChild(div)
      div.focus()

      const result = isEditingElement()
      expect(result).toBe(false)
    })

    it('應該在沒有焦點元素時回傳 false', () => {
      document.body.innerHTML = ''
      document.activeElement?.blur?.()

      const result = isEditingElement()
      expect(result).toBe(false)
    })
  })

  describe('hasTextSelection', () => {
    beforeEach(() => {
      window.getSelection()?.removeAllRanges()
    })

    it('應該在有文字選取時回傳 true', () => {
      const div = document.createElement('div')
      div.textContent = 'test content'
      document.body.appendChild(div)

      const range = document.createRange()
      range.selectNodeContents(div)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      const result = hasTextSelection()
      expect(result).toBe(true)
    })

    it('應該在沒有文字選取時回傳 false', () => {
      window.getSelection()?.removeAllRanges()

      const result = hasTextSelection()
      expect(result).toBe(false)
    })

    it('應該在 selection 為 null 時回傳 false', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null)

      const result = hasTextSelection()
      expect(result).toBe(false)

      vi.restoreAllMocks()
    })
  })

  describe('getPlatformModifierKey', () => {
    it('應該在 Mac 平台回傳 metaKey', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

      const result = getPlatformModifierKey()
      expect(result).toBe('metaKey')

      vi.restoreAllMocks()
    })

    it('應該在 Windows 平台回傳 ctrlKey', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

      const result = getPlatformModifierKey()
      expect(result).toBe('ctrlKey')

      vi.restoreAllMocks()
    })

    it('應該在 Linux 平台回傳 ctrlKey', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64)')

      const result = getPlatformModifierKey()
      expect(result).toBe('ctrlKey')

      vi.restoreAllMocks()
    })

    it('應該不區分 userAgent 大小寫', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('mozilla/5.0 (macintosh)')

      const result = getPlatformModifierKey()
      expect(result).toBe('metaKey')

      vi.restoreAllMocks()
    })
  })

  describe('isModifierKeyPressed', () => {
    it('應該在 Mac 平台檢查 metaKey', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

      const event = { metaKey: true, ctrlKey: false } as KeyboardEvent
      const result = isModifierKeyPressed(event)
      expect(result).toBe(true)

      vi.restoreAllMocks()
    })

    it('應該在 Windows 平台檢查 ctrlKey', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent
      const result = isModifierKeyPressed(event)
      expect(result).toBe(true)

      vi.restoreAllMocks()
    })

    it('應該在 Mac 平台且 metaKey 為 false 時回傳 false', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent
      const result = isModifierKeyPressed(event)
      expect(result).toBe(false)

      vi.restoreAllMocks()
    })

    it('應該在 Windows 平台且 ctrlKey 為 false 時回傳 false', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

      const event = { metaKey: true, ctrlKey: false } as KeyboardEvent
      const result = isModifierKeyPressed(event)
      expect(result).toBe(false)

      vi.restoreAllMocks()
    })
  })
})
