<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/pod'
import { useCanvasPan, useCanvasZoom, useBoxSelect } from '@/composables/canvas'
import { GRID_SIZE } from '@/lib/constants'

const viewportStore = useViewportStore()
const { startPan, hasPanned, resetPanState } = useCanvasPan()
const { handleWheel } = useCanvasZoom()
const { startBoxSelect } = useBoxSelect()

const emit = defineEmits<{
  contextmenu: [e: MouseEvent]
}>()

const gridStyle = computed(() => {
  const { offset, zoom } = viewportStore
  const gridSizeScaled = GRID_SIZE * zoom

  return {
    backgroundPosition: `${offset.x % gridSizeScaled}px ${offset.y % gridSizeScaled}px`,
    backgroundSize: `${gridSizeScaled}px ${gridSizeScaled}px`,
  }
})

const handleContextMenu = (e: MouseEvent): void => {
  e.preventDefault() // 防止瀏覽器預設右鍵選單

  // 如果剛剛有拖曳過畫布，不顯示選單
  if (hasPanned.value) {
    resetPanState()
    return
  }

  emit('contextmenu', e)
}

const handleMouseDown = (e: MouseEvent): void => {
  if (e.button === 2) {
    startPan(e)
    return
  }

  if (e.button === 0) {
    startBoxSelect(e)
  }
}
</script>

<template>
  <div
    class="viewport h-full canvas-grid"
    :style="gridStyle"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
  >
    <div
      class="canvas-content h-full"
      :style="{
        transform: `translate(${viewportStore.offset.x}px, ${viewportStore.offset.y}px) scale(${viewportStore.zoom})`,
        transformOrigin: '0 0',
      }"
    >
      <slot />
    </div>
  </div>
</template>
