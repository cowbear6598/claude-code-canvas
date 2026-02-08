import { beforeEach, vi } from 'vitest'

// UUID 計數器
let uuidCounter = 0

// Mock window.crypto.randomUUID
Object.defineProperty(window.crypto, 'randomUUID', {
  writable: true,
  value: vi.fn(() => `test-uuid-${++uuidCounter}`),
})

// Mock window.requestAnimationFrame
window.requestAnimationFrame = vi.fn((cb) => {
  cb(0)
  return 0
})

// Mock console.warn 和 console.error
console.warn = vi.fn()
console.error = vi.fn()

// 每個測試前重置
beforeEach(() => {
  vi.clearAllMocks()
  uuidCounter = 0
})
