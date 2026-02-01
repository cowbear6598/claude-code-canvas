import type { Trigger } from '@/types/trigger'
import { TRIGGER_WIDTH, TRIGGER_HEIGHT } from '@/lib/constants'

interface TriggerAnchorPoint {
  triggerId: string
  anchor: 'right'
  x: number
  y: number
}

export function useTriggerAnchorDetection(): {
  getTriggerAnchorPosition: (trigger: Trigger) => TriggerAnchorPoint
} {
  const getTriggerAnchorPosition = (trigger: Trigger): TriggerAnchorPoint => {
    const rotation = trigger.rotation || 0
    const radians = (rotation * Math.PI) / 180

    const centerX = trigger.x + TRIGGER_WIDTH / 2
    const centerY = trigger.y + TRIGGER_HEIGHT / 2

    const localX = TRIGGER_WIDTH
    const localY = TRIGGER_HEIGHT / 2

    const relativeX = localX - TRIGGER_WIDTH / 2
    const relativeY = localY - TRIGGER_HEIGHT / 2

    const rotatedX = relativeX * Math.cos(radians) - relativeY * Math.sin(radians)
    const rotatedY = relativeX * Math.sin(radians) + relativeY * Math.cos(radians)

    const x = centerX + rotatedX
    const y = centerY + rotatedY

    return {
      triggerId: trigger.id,
      anchor: 'right',
      x,
      y
    }
  }

  return {
    getTriggerAnchorPosition
  }
}
