import { createTestingPinia, type TestingPinia } from '@pinia/testing'
import { vi } from 'vitest'

/**
 * 建立測試用的 Pinia 實例
 *
 * @param options - 可選的配置參數
 * @returns TestingPinia 實例
 *
 * @example
 * ```ts
 * import { setupTestPinia } from '@/__tests__/helpers/mockStoreFactory'
 * import { setActivePinia } from 'pinia'
 * import { usePodStore } from '@/stores/pod'
 *
 * const pinia = setupTestPinia()
 * setActivePinia(pinia)
 * const podStore = usePodStore()
 * ```
 */
export function setupTestPinia(options?: {
  stubActions?: boolean
  initialState?: Record<string, unknown>
}): TestingPinia {
  const pinia = createTestingPinia({
    stubActions: options?.stubActions ?? false, // 預設讓 action 真正執行
    createSpy: vi.fn,
    initialState: options?.initialState,
  })

  return pinia
}
