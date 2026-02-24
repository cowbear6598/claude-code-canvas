export interface DOMNodeHandlers<T> {
  onText: (text: string) => T
  onBreak: () => T
  onImage: (element: HTMLElement) => T
  combine: (results: T[]) => T
}

export function walkDOM<T>(node: Node, handlers: DOMNodeHandlers<T>): T {
  if (node.nodeType === Node.TEXT_NODE) {
    return handlers.onText(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return handlers.combine([])
  }

  const element = node as HTMLElement

  if (element.nodeName === 'BR') {
    return handlers.onBreak()
  }

  if (element.dataset.type === 'image') {
    return handlers.onImage(element)
  }

  const results: T[] = []
  for (const child of Array.from(element.childNodes)) {
    results.push(walkDOM(child, handlers))
  }
  return handlers.combine(results)
}
