import type { AnchorPosition } from '@/types/connection'

export interface PathData {
  path: string
  midPoint: { x: number; y: number }
  angle: number
}

export interface ArrowPosition {
  x: number
  y: number
  angle: number
}

export function useConnectionPath(): {
  calculatePathData: (startX: number, startY: number, endX: number, endY: number, sourceAnchor: AnchorPosition, targetAnchor: AnchorPosition) => PathData
  calculateMultipleArrowPositions: (startX: number, startY: number, endX: number, endY: number, sourceAnchor: AnchorPosition, targetAnchor: AnchorPosition, spacing?: number) => ArrowPosition[]
} {
  const calculateControlPoints = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sourceAnchor: AnchorPosition,
    targetAnchor: AnchorPosition
  ): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } => {
    const dx = endX - startX
    const dy = endY - startY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const offset = Math.min(distance * 0.3, 100)

    let cp1x = startX
    let cp1y = startY
    let cp2x = endX
    let cp2y = endY

    if (sourceAnchor === 'top') {
      cp1y -= offset
    } else if (sourceAnchor === 'bottom') {
      cp1y += offset
    } else if (sourceAnchor === 'left') {
      cp1x -= offset
    } else if (sourceAnchor === 'right') {
      cp1x += offset
    }

    if (targetAnchor === 'top') {
      cp2y -= offset
    } else if (targetAnchor === 'bottom') {
      cp2y += offset
    } else if (targetAnchor === 'left') {
      cp2x -= offset
    } else if (targetAnchor === 'right') {
      cp2x += offset
    }

    return { cp1x, cp1y, cp2x, cp2y }
  }

  const calculateBezierPoint = (
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number
  ): number => {
    const mt = 1 - t
    return (
      mt * mt * mt * p0 +
      3 * mt * mt * t * p1 +
      3 * mt * t * t * p2 +
      t * t * t * p3
    )
  }

  const calculateBezierTangent = (
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number
  ): number => {
    const mt = 1 - t
    const t2 = t * t
    const mt2 = mt * mt
    return (
      3 * mt2 * (p1 - p0) +
      6 * mt * t * (p2 - p1) +
      3 * t2 * (p3 - p2)
    )
  }

  const calculatePathData = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sourceAnchor: AnchorPosition,
    targetAnchor: AnchorPosition
  ): PathData => {
    const { cp1x, cp1y, cp2x, cp2y } = calculateControlPoints(
      startX,
      startY,
      endX,
      endY,
      sourceAnchor,
      targetAnchor
    )

    const path = `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`

    const midX = calculateBezierPoint(0.5, startX, cp1x, cp2x, endX)
    const midY = calculateBezierPoint(0.5, startY, cp1y, cp2y, endY)

    const t = 0.5
    const dt = 0.01
    const beforeX = calculateBezierPoint(t - dt, startX, cp1x, cp2x, endX)
    const beforeY = calculateBezierPoint(t - dt, startY, cp1y, cp2y, endY)
    const afterX = calculateBezierPoint(t + dt, startX, cp1x, cp2x, endX)
    const afterY = calculateBezierPoint(t + dt, startY, cp1y, cp2y, endY)

    const angle = Math.atan2(afterY - beforeY, afterX - beforeX) * (180 / Math.PI)

    return {
      path,
      midPoint: { x: midX, y: midY },
      angle,
    }
  }

  const calculateMultipleArrowPositions = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sourceAnchor: AnchorPosition,
    targetAnchor: AnchorPosition,
    spacing: number = 80
  ): ArrowPosition[] => {
    const { cp1x, cp1y, cp2x, cp2y } = calculateControlPoints(
      startX,
      startY,
      endX,
      endY,
      sourceAnchor,
      targetAnchor
    )

    const dx = endX - startX
    const dy = endY - startY
    const straightDistance = Math.sqrt(dx * dx + dy * dy)
    const estimatedLength = straightDistance * 1.2

    const arrowCount = Math.max(1, Math.floor(estimatedLength / spacing))

    const arrows: ArrowPosition[] = []
    for (let i = 1; i <= arrowCount; i++) {
      const t = i / (arrowCount + 1)

      const x = calculateBezierPoint(t, startX, cp1x, cp2x, endX)
      const y = calculateBezierPoint(t, startY, cp1y, cp2y, endY)

      const tangentX = calculateBezierTangent(t, startX, cp1x, cp2x, endX)
      const tangentY = calculateBezierTangent(t, startY, cp1y, cp2y, endY)
      const angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI)

      arrows.push({ x, y, angle })
    }

    return arrows
  }

  return {
    calculatePathData,
    calculateMultipleArrowPositions,
  }
}
