import { MAX_POD_NAME_LENGTH } from '@/lib/constants'

/**
 * 驗證 Pod 名稱
 * @param name Pod 名稱
 * @returns 是否有效
 */
export function validatePodName(name: string): boolean {
  const trimmedName = name.trim()
  return trimmedName.length > 0 && trimmedName.length <= MAX_POD_NAME_LENGTH
}
