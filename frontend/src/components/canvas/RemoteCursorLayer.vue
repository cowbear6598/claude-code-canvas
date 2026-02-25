<script setup lang="ts">
import { computed } from 'vue'
import { useCursorStore } from '@/stores/cursorStore'
import { useViewportStore } from '@/stores/pod/viewportStore'

const cursorStore = useCursorStore()
const viewportStore = useViewportStore()

const screenCursors = computed(() => {
  return Array.from(cursorStore.cursors.values()).map((cursor) => ({
    ...cursor,
    screenX: cursor.x * viewportStore.zoom + viewportStore.offset.x,
    screenY: cursor.y * viewportStore.zoom + viewportStore.offset.y,
  }))
})
</script>

<template>
  <div
    class="remote-cursor-layer"
    style="pointer-events: none"
  >
    <svg
      width="0"
      height="0"
      style="position: absolute"
    >
      <defs>
        <filter id="cursor-shadow">
          <feDropShadow
            dx="0"
            dy="0.5"
            stdDeviation="0.5"
            flood-opacity="0.3"
          />
        </filter>
      </defs>
    </svg>

    <div
      v-for="cursor in screenCursors"
      :key="cursor.connectionId"
      class="remote-cursor"
      :style="{
        left: `${cursor.screenX}px`,
        top: `${cursor.screenY}px`,
      }"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 2 L2 15 L6 11 L9 18 L11 17 L8 10 L13 10 Z"
          :fill="cursor.color"
          stroke="white"
          stroke-width="1"
          filter="url(#cursor-shadow)"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.remote-cursor-layer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  transition: left 0.1s linear, top 0.1s linear;
}
</style>
