import type {Ref} from 'vue'
import type {ContentBlock} from '@/types/websocket/requests'
import {walkDOM} from '@/utils/chatInputDOM'
import type {DOMNodeHandlers} from '@/utils/chatInputDOM'
import type {ImageAttachment} from './useImageAttachment'

export function useContentBlocks(options: {
  editableRef: Ref<HTMLDivElement | null>
  imageDataMap: WeakMap<HTMLElement, ImageAttachment>
}): {
  countTextLength: (node: Node) => number
  buildContentBlocks: () => ContentBlock[]
  extractTextFromBlocks: (blocks: ContentBlock[]) => string
} {
  const {editableRef, imageDataMap} = options

  const textLengthHandlers: DOMNodeHandlers<number> = {
    onText: (text) => text.length,
    onBreak: () => 1,
    onImage: () => 0,
    combine: (results) => results.reduce((sum, n) => sum + n, 0),
  }

  const countTextLength = (node: Node): number => walkDOM(node, textLengthHandlers)

  const flushTextToBlocks = (blocks: ContentBlock[], currentText: string[]): void => {
    if (currentText.length === 0) return

    const text = currentText.join('')
    if (text.trim()) {
      blocks.push({type: 'text', text})
    }
    currentText.length = 0
  }

  const makeContentBlockHandlers = (
      blocks: ContentBlock[],
      currentText: string[]
  ): DOMNodeHandlers<void> => ({
    onText: (text): void => { if (text) currentText.push(text) },
    onBreak: (): void => { currentText.push('\n') },
    onImage: (element): void => {
      const imageData = imageDataMap.get(element)
      if (imageData) {
        flushTextToBlocks(blocks, currentText)
        blocks.push({
          type: 'image',
          mediaType: imageData.mediaType,
          base64Data: imageData.base64Data
        })
      }
    },
    combine: (): void => undefined,
  })

  const parseContentBlocks = (
      node: Node,
      blocks: ContentBlock[],
      currentText: string[]
  ): void => { walkDOM(node, makeContentBlockHandlers(blocks, currentText)) }

  const buildContentBlocks = (): ContentBlock[] => {
    const element = editableRef.value
    if (!element) return []

    const blocks: ContentBlock[] = []
    const currentText: string[] = []

    for (const child of Array.from(element.childNodes)) {
      parseContentBlocks(child, blocks, currentText)
    }

    flushTextToBlocks(blocks, currentText)

    return blocks
  }

  const extractTextFromBlocks = (blocks: ContentBlock[]): string => {
    return blocks
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('')
  }

  return {countTextLength, buildContentBlocks, extractTextFromBlocks}
}
