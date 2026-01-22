<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'

const store = useCanvasStore()

const MINIMAP_WIDTH = 200
const MINIMAP_HEIGHT = 150
const POD_WIDTH = 224
const POD_HEIGHT = 200

const isDraggingViewport = ref(false)

// 動態計算畫布邊界，包含所有 Pod 和視口範圍
const canvasBounds = computed(() => {
  if (store.pods.length === 0) {
    // 沒有 Pod 時，只顯示視口範圍
    const viewLeft = -store.viewport.offset.x / store.viewport.zoom
    const viewTop = -store.viewport.offset.y / store.viewport.zoom
    const viewRight = viewLeft + window.innerWidth / store.viewport.zoom
    const viewBottom = viewTop + window.innerHeight / store.viewport.zoom

    return {
      minX: viewLeft - 100,
      minY: viewTop - 100,
      maxX: viewRight + 100,
      maxY: viewBottom + 100,
      width: viewRight - viewLeft + 200,
      height: viewBottom - viewTop + 200,
    }
  }

  // 獲取所有 Pod 的邊界
  const podXs = store.pods.map(p => p.x)
  const podYs = store.pods.map(p => p.y)

  // 獲取當前視口在畫布上的範圍
  const viewLeft = -store.viewport.offset.x / store.viewport.zoom
  const viewTop = -store.viewport.offset.y / store.viewport.zoom
  const viewRight = viewLeft + window.innerWidth / store.viewport.zoom
  const viewBottom = viewTop + window.innerHeight / store.viewport.zoom

  // 計算邊界（包含所有 Pod 和視口）
  const minX = Math.min(0, ...podXs, viewLeft) - 100
  const minY = Math.min(0, ...podYs, viewTop) - 100
  const maxX = Math.max(window.innerWidth, ...podXs.map(x => x + POD_WIDTH), viewRight) + 100
  const maxY = Math.max(window.innerHeight, ...podYs.map(y => y + POD_HEIGHT), viewBottom) + 100

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
})

// Pod 在小地圖上的位置（按比例縮小）
const minimapPods = computed(() => {
  const bounds = canvasBounds.value
  const scale = Math.min(MINIMAP_WIDTH / bounds.width, MINIMAP_HEIGHT / bounds.height)

  return store.pods.map(pod => ({
    x: (pod.x - bounds.minX) * scale,
    y: (pod.y - bounds.minY) * scale,
    width: POD_WIDTH * scale,
    height: POD_HEIGHT * scale,
    color: pod.color,
  }))
})

// 視口矩形（藍色框）
const viewportRect = computed(() => {
  const bounds = canvasBounds.value
  const scale = Math.min(MINIMAP_WIDTH / bounds.width, MINIMAP_HEIGHT / bounds.height)

  // 視口在畫布上的位置和大小
  const viewLeft = -store.viewport.offset.x / store.viewport.zoom
  const viewTop = -store.viewport.offset.y / store.viewport.zoom
  const viewWidth = window.innerWidth / store.viewport.zoom
  const viewHeight = window.innerHeight / store.viewport.zoom

  return {
    x: (viewLeft - bounds.minX) * scale,
    y: (viewTop - bounds.minY) * scale,
    width: viewWidth * scale,
    height: viewHeight * scale,
  }
})

// 點擊小地圖跳轉
const handleMinimapClick = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  const bounds = canvasBounds.value
  const scale = Math.min(MINIMAP_WIDTH / bounds.width, MINIMAP_HEIGHT / bounds.height)

  // 小地圖座標 -> 畫布座標
  const canvasX = clickX / scale + bounds.minX
  const canvasY = clickY / scale + bounds.minY

  // 設置 offset 使該點位於視口中心
  const newOffsetX = -(canvasX * store.viewport.zoom - window.innerWidth / 2)
  const newOffsetY = -(canvasY * store.viewport.zoom - window.innerHeight / 2)

  store.setOffset(newOffsetX, newOffsetY)
}

const startDragViewport = () => {
  isDraggingViewport.value = true

  const handleMove = (moveEvent: MouseEvent) => {
    handleMinimapClick(moveEvent)
  }

  const handleUp = () => {
    isDraggingViewport.value = false
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleUp)
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleUp)
}

const podColorClasses: Record<string, string> = {
  blue: 'bg-blue-400',
  coral: 'bg-red-400',
  pink: 'bg-pink-400',
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
}
</script>

<template>
  <div
    class="fixed bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200"
  >
    <!-- Minimap Canvas -->
    <div
      class="relative bg-gray-50 rounded cursor-pointer select-none"
      :style="{
        width: `${MINIMAP_WIDTH}px`,
        height: `${MINIMAP_HEIGHT}px`,
      }"
      @mousedown="handleMinimapClick"
    >
      <!-- Pods -->
      <div
        v-for="(pod, index) in minimapPods"
        :key="index"
        class="absolute rounded-sm"
        :class="podColorClasses[pod.color] || 'bg-gray-400'"
        :style="{
          left: `${pod.x}px`,
          top: `${pod.y}px`,
          width: `${pod.width}px`,
          height: `${pod.height}px`,
        }"
      />

      <!-- Viewport Rectangle -->
      <div
        class="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
        :style="{
          left: `${viewportRect.x}px`,
          top: `${viewportRect.y}px`,
          width: `${viewportRect.width}px`,
          height: `${viewportRect.height}px`,
        }"
        @mousedown.stop="startDragViewport"
      />
    </div>

    <!-- Zoom Indicator -->
    <div class="mt-2 text-xs text-gray-600 text-center">
      {{ Math.round(store.viewport.zoom * 100) }}%
    </div>
  </div>
</template>
