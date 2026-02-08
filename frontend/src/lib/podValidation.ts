import type { Pod, PodColor } from '@/types'
import { validatePodName } from '@/lib/sanitize'

/**
 * 合法的 Pod 顏色清單
 */
const VALID_POD_COLORS: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green']

/**
 * 驗證 Pod 是否有效
 * @param pod Pod 物件
 * @returns 是否有效
 */
export function isValidPod(pod: Pod): boolean {
  return (
    validatePodName(pod.name) &&
    Array.isArray(pod.output) &&
    pod.output.every(item => typeof item === 'string') &&
    pod.id.trim() !== '' &&
    VALID_POD_COLORS.includes(pod.color) &&
    isFinite(pod.x) &&
    isFinite(pod.y) &&
    isFinite(pod.rotation)
  )
}

/**
 * 補全 Pod 缺少的欄位
 * @param pod Pod 物件
 * @param existingOutput 現有的 output（用於保留）
 * @returns 補全後的 Pod
 */
export function enrichPod(pod: Pod, existingOutput?: string[]): Pod {
  return {
    ...pod,
    x: pod.x ?? 100,
    y: pod.y ?? 150,
    rotation: pod.rotation ?? (Math.random() * 2 - 1),
    output: Array.isArray(existingOutput) ? existingOutput : (Array.isArray(pod.output) ? pod.output : []),
    outputStyleId: pod.outputStyleId ?? null,
    model: pod.model ?? 'opus',
    autoClear: pod.autoClear ?? false,
    commandId: pod.commandId ?? null,
    schedule: pod.schedule ?? null,
  }
}
