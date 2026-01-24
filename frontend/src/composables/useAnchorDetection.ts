import type { Pod } from '@/types/pod'
import type { AnchorPoint, AnchorPosition } from '@/types/connection'

const DETECTION_RADIUS = 20
const POD_WIDTH = 224
const POD_HEIGHT = 168

export function useAnchorDetection() {
  const getAnchorPositions = (pod: Pod): AnchorPoint[] => {
    const anchors: AnchorPoint[] = []
    const positions: AnchorPosition[] = ['top', 'bottom', 'left', 'right']

    const rotation = pod.rotation || 0
    const radians = (rotation * Math.PI) / 180

    const centerX = pod.x + POD_WIDTH / 2
    const centerY = pod.y + POD_HEIGHT / 2

    positions.forEach(anchor => {
      let localX = 0
      let localY = 0

      if (anchor === 'top') {
        localX = POD_WIDTH / 2
        localY = 0
      } else if (anchor === 'bottom') {
        localX = POD_WIDTH / 2
        localY = POD_HEIGHT
      } else if (anchor === 'left') {
        localX = 0
        localY = POD_HEIGHT / 2
      } else if (anchor === 'right') {
        localX = POD_WIDTH
        localY = POD_HEIGHT / 2
      }

      const relativeX = localX - POD_WIDTH / 2
      const relativeY = localY - POD_HEIGHT / 2

      const rotatedX = relativeX * Math.cos(radians) - relativeY * Math.sin(radians)
      const rotatedY = relativeX * Math.sin(radians) + relativeY * Math.cos(radians)

      const x = centerX + rotatedX
      const y = centerY + rotatedY

      anchors.push({ podId: pod.id, anchor, x, y })
    })

    return anchors
  }

  const detectTargetAnchor = (
    point: { x: number; y: number },
    pods: Pod[],
    sourcePodId: string
  ): AnchorPoint | null => {
    for (const pod of pods) {
      if (pod.id === sourcePodId) continue

      const anchors = getAnchorPositions(pod)

      for (const anchor of anchors) {
        const dx = point.x - anchor.x
        const dy = point.y - anchor.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= DETECTION_RADIUS) {
          return anchor
        }
      }
    }

    return null
  }

  return {
    getAnchorPositions,
    detectTargetAnchor,
  }
}
