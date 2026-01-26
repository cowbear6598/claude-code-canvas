export function isEditingElement(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toUpperCase()
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }

  return activeElement.getAttribute('contenteditable') === 'true';


}

export function hasTextSelection(): boolean {
  const selection = window.getSelection()
  if (!selection) return false
  return selection.toString().length > 0
}

export function getPlatformModifierKey(): 'metaKey' | 'ctrlKey' {
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  return isMac ? 'metaKey' : 'ctrlKey'
}

export function isModifierKeyPressed(event: KeyboardEvent): boolean {
  const modifierKey = getPlatformModifierKey()
  return event[modifierKey]
}
