import { MAX_MESSAGE_LENGTH, MAX_POD_NAME_LENGTH } from '@/lib/constants'

/**
 * 消毒文字輸入
 * @param text 輸入文字
 * @param maxLength 最大長度
 * @returns 消毒後的文字
 */
export function sanitizeText(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  return text.trim().slice(0, maxLength)
}

/**
 * 驗證 Pod 名稱
 * @param name Pod 名稱
 * @returns 是否有效
 */
export function validatePodName(name: string): boolean {
  const trimmedName = name.trim()
  return trimmedName.length > 0 && trimmedName.length <= MAX_POD_NAME_LENGTH
}
