import { describe, it, expect } from 'vitest'
import { walkDOM } from '@/utils/chatInputDOM'
import type { DOMNodeHandlers } from '@/utils/chatInputDOM'

// 計算文字長度的 handlers（模擬 countTextLength 的行為）
const lengthHandlers: DOMNodeHandlers<number> = {
  onText: (text) => text.length,
  onBreak: () => 1,
  onImage: () => 0,
  combine: (results) => results.reduce((sum, n) => sum + n, 0),
}

describe('walkDOM', () => {
  describe('TEXT_NODE 處理', () => {
    it('應該回傳文字節點的字元長度', () => {
      const text = document.createTextNode('hello')
      expect(walkDOM(text, lengthHandlers)).toBe(5)
    })

    it('應該在文字為空時回傳 0', () => {
      const text = document.createTextNode('')
      expect(walkDOM(text, lengthHandlers)).toBe(0)
    })
  })

  describe('BR 元素處理', () => {
    it('BR 應計算為 1 個字元', () => {
      const br = document.createElement('br')
      expect(walkDOM(br, lengthHandlers)).toBe(1)
    })
  })

  describe('圖片元素處理', () => {
    it('圖片 atom 應回傳 0（不計入文字長度）', () => {
      const span = document.createElement('span')
      span.dataset.type = 'image'
      expect(walkDOM(span, lengthHandlers)).toBe(0)
    })

    it('onImage handler 應收到正確的 HTMLElement', () => {
      const span = document.createElement('span')
      span.dataset.type = 'image'
      span.dataset.id = 'test-img'

      let capturedElement: HTMLElement | null = null
      const handlers: DOMNodeHandlers<void> = {
        onText: () => undefined,
        onBreak: () => undefined,
        onImage: (el) => { capturedElement = el },
        combine: () => undefined,
      }

      walkDOM(span, handlers)
      expect(capturedElement).toBe(span)
    })
  })

  describe('非 ELEMENT_NODE 處理', () => {
    it('非元素節點（例如 comment node）應回傳空 combine 結果', () => {
      const comment = document.createComment('test')
      expect(walkDOM(comment, lengthHandlers)).toBe(0)
    })
  })

  describe('遞迴遍歷子節點', () => {
    it('應遞迴累加子節點文字長度', () => {
      const div = document.createElement('div')
      div.appendChild(document.createTextNode('foo'))
      div.appendChild(document.createElement('br'))
      div.appendChild(document.createTextNode('bar'))
      // foo(3) + br(1) + bar(3) = 7
      expect(walkDOM(div, lengthHandlers)).toBe(7)
    })

    it('應遞迴處理巢狀元素', () => {
      const outer = document.createElement('div')
      const inner = document.createElement('span')
      inner.appendChild(document.createTextNode('hello'))
      outer.appendChild(inner)
      expect(walkDOM(outer, lengthHandlers)).toBe(5)
    })

    it('圖片子元素不應計入文字長度', () => {
      const div = document.createElement('div')
      div.appendChild(document.createTextNode('abc'))
      const img = document.createElement('span')
      img.dataset.type = 'image'
      div.appendChild(img)
      div.appendChild(document.createTextNode('def'))
      // abc(3) + image(0) + def(3) = 6
      expect(walkDOM(div, lengthHandlers)).toBe(6)
    })
  })

  describe('收集文字 blocks 的使用情境', () => {
    it('應依序收集文字、換行、文字', () => {
      const div = document.createElement('div')
      div.appendChild(document.createTextNode('line1'))
      div.appendChild(document.createElement('br'))
      div.appendChild(document.createTextNode('line2'))

      const collected: string[] = []
      const handlers: DOMNodeHandlers<void> = {
        onText: (text) => { collected.push(text) },
        onBreak: () => { collected.push('\n') },
        onImage: () => undefined,
        combine: () => undefined,
      }

      walkDOM(div, handlers)
      expect(collected).toEqual(['line1', '\n', 'line2'])
    })

    it('圖片元素應觸發 onImage 而非遞迴子節點', () => {
      const div = document.createElement('div')
      const imgSpan = document.createElement('span')
      imgSpan.dataset.type = 'image'
      // 即使圖片 span 有子節點，也不應遞迴進去
      imgSpan.appendChild(document.createTextNode('[image]'))
      div.appendChild(imgSpan)

      const texts: string[] = []
      let imageCallCount = 0
      const handlers: DOMNodeHandlers<void> = {
        onText: (text) => { texts.push(text) },
        onBreak: () => undefined,
        onImage: () => { imageCallCount++ },
        combine: () => undefined,
      }

      walkDOM(div, handlers)
      expect(imageCallCount).toBe(1)
      expect(texts).toEqual([])
    })
  })
})
