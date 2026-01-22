<script setup lang="ts">
import { useCanvasStore } from '@/stores/canvasStore'
import CanvasViewport from './CanvasViewport.vue'
import Minimap from './Minimap.vue'
import EmptyState from './EmptyState.vue'
import PodTypeMenu from './PodTypeMenu.vue'
import CanvasPod from '@/components/pod/CanvasPod.vue'
import type { PodTypeConfig } from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

const store = useCanvasStore()

const handleDoubleClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  // 只在直接點擊畫布時才顯示選單（排除 Pod 元素）
  if (
    target.classList.contains('viewport') ||
    target.classList.contains('canvas-content')
  ) {
    // 選單使用螢幕座標（因為是 position: fixed）
    store.showTypeMenu({ x: e.clientX, y: e.clientY })
  }
}

const handleSelectType = (config: PodTypeConfig) => {
  if (!store.typeMenu.position) return

  // 將螢幕座標轉換為畫布座標
  // 螢幕座標 -> 視口座標 -> 畫布座標
  const canvasX = (store.typeMenu.position.x - store.viewport.offset.x) / store.viewport.zoom
  const canvasY = (store.typeMenu.position.y - store.viewport.offset.y) / store.viewport.zoom

  const rotation = Math.random() * DEFAULT_POD_ROTATION_RANGE - (DEFAULT_POD_ROTATION_RANGE / 2)
  const newPod = {
    id: Date.now().toString(),
    name: `${config.type.split(' ')[0]} ${store.podCount + 1}`,
    type: config.type,
    x: canvasX - POD_MENU_X_OFFSET,
    y: canvasY - POD_MENU_Y_OFFSET,
    color: config.color,
    output: ['Ready to help!', 'Click to start...'],
    rotation: Math.round(rotation * 10) / 10,
  }

  store.addPod(newPod)
  store.hideTypeMenu()
}

const handleSelectPod = (podId: string) => {
  store.selectPod(podId)
}

const handleDeletePod = (id: string) => {
  store.deletePod(id)
}

const handleDragEnd = (data: { id: string; x: number; y: number }) => {
  store.movePod(data.id, data.x, data.y)
}
</script>

<template>
  <CanvasViewport @dblclick="handleDoubleClick">
    <!-- Pod 列表 -->
    <CanvasPod
      v-for="pod in store.pods"
      :key="pod.id"
      :pod="pod"
      @select="handleSelectPod"
      @update="store.updatePod"
      @delete="handleDeletePod"
      @drag-end="handleDragEnd"
    />

    <!-- 空狀態 -->
    <EmptyState v-if="store.podCount === 0" />
  </CanvasViewport>

  <!-- Pod 類型選單 - 放在 transform 容器外面 -->
  <PodTypeMenu
    v-if="store.typeMenu.visible && store.typeMenu.position"
    :position="store.typeMenu.position"
    @select="handleSelectType"
    @close="store.hideTypeMenu"
  />

  <!-- Minimap -->
  <Minimap />
</template>
