import { useCanvasStore } from '@/stores/canvasStore'

export function requireActiveCanvas(): string {
    const canvasStore = useCanvasStore()

    if (!canvasStore.activeCanvasId) {
        throw new Error('沒有啟用的畫布')
    }

    return canvasStore.activeCanvasId
}

export function getActiveCanvasIdOrWarn(context: string): string | null {
    const canvasStore = useCanvasStore()

    if (!canvasStore.activeCanvasId) {
        console.warn(`[${context}] 沒有啟用的畫布`)
        return null
    }

    return canvasStore.activeCanvasId
}
