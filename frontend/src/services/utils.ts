/**
 * 生成 UUID
 * 優先使用 crypto.randomUUID（安全上下文），否則使用 crypto.getRandomValues fallback
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback：使用 crypto.getRandomValues()（非安全上下文也可用）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const randomNibble = (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) % 16
    const hexDigit = c === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8
    return hexDigit.toString(16)
  })
}

export function generateRequestId(): string {
  return generateUUID()
}
