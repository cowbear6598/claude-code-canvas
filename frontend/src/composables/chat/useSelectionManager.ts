import type {Ref} from 'vue'

export function useSelectionManager(options: {
  editableRef: Ref<HTMLDivElement | null>
}): {
  moveCursorToEnd: () => void
  insertNodeAtCursor: (node: Node) => void
  insertLineBreak: (event: KeyboardEvent) => void
  handleTextPaste: (event: ClipboardEvent, onSyncInput: (text: string) => void) => void
  findImageAtomBefore: (range: Range) => HTMLElement | null
} {
  const {editableRef} = options

  const moveCursorToEnd = (): void => {
    const element = editableRef.value
    if (!element) return

    const range = document.createRange()
    const selection = window.getSelection()
    if (!selection) return

    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const insertNodeAtCursor = (node: Node): void => {
    const element = editableRef.value
    if (!element) return

    const selection = window.getSelection()
    if (!selection) return

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null

    if (range && element.contains(range.commonAncestorContainer)) {
      range.deleteContents()
      range.insertNode(node)

      range.setStartAfter(node)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      element.appendChild(node)
      moveCursorToEnd()
    }

    element.dispatchEvent(new Event('input', {bubbles: true}))
  }

  const insertLineBreak = (event: KeyboardEvent): void => {
    event.preventDefault()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()
    const br = document.createElement('br')
    range.insertNode(br)
    range.setStartAfter(br)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    editableRef.value?.dispatchEvent(new Event('input', {bubbles: true}))
  }

  // 貼上後需要同步 input.value，由呼叫端透過 onSyncInput callback 處理
  const handleTextPaste = (event: ClipboardEvent, onSyncInput: (text: string) => void): void => {
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)
    onSyncInput(editableRef.value?.innerText ?? '')
  }

  const isImageAtom = (node: Node | null): node is HTMLElement => {
    return node !== null &&
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).dataset.type === 'image'
  }

  const findImageAtomBefore = (range: Range): HTMLElement | null => {
    const {startContainer, startOffset} = range

    if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const node = startContainer.childNodes[startOffset - 1] ?? null
      return isImageAtom(node) ? node : null
    }

    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
      const prev = startContainer.previousSibling
      return isImageAtom(prev) ? prev : null
    }

    return null
  }

  return {
    moveCursorToEnd,
    insertNodeAtCursor,
    insertLineBreak,
    handleTextPaste,
    findImageAtomBefore,
  }
}
