<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import { useCanvasStore } from '@/stores/canvasStore'
import ConnectionLine from './ConnectionLine.vue'
import ConnectionSettingsPopover from './ConnectionSettingsPopover.vue'

const connectionStore = useConnectionStore()
const canvasStore = useCanvasStore()

const showSettings = ref(false)
const settingsPosition = ref({ x: 0, y: 0 })

const draggingPathData = computed(() => {
  if (!connectionStore.draggingConnection) {
    return ''
  }

  const { startPoint, currentPoint } = connectionStore.draggingConnection

  // 拖拽預覽線使用直線，不用貝茲曲線
  return `M ${startPoint.x} ${startPoint.y} L ${currentPoint.x} ${currentPoint.y}`
})

const handleSelectConnection = (connectionId: string) => {
  connectionStore.selectConnection(connectionId)
}

const handleCanvasClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    connectionStore.selectConnection(null)
  }
}

const handleConnectionRightClick = (connectionId: string, event: MouseEvent) => {
  event.preventDefault()
  connectionStore.selectConnection(connectionId)
  settingsPosition.value = { x: event.clientX, y: event.clientY }
  showSettings.value = true
}

const handleCloseSettings = () => {
  showSettings.value = false
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (connectionStore.selectedConnectionId) {
      connectionStore.deleteConnection(connectionStore.selectedConnectionId)
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div>
    <svg class="connection-layer" @click="handleCanvasClick">
      <ConnectionLine
        v-for="connection in connectionStore.connections"
        :key="connection.id"
        :connection="connection"
        :pods="canvasStore.pods"
        :is-selected="connection.id === connectionStore.selectedConnectionId"
        :status="connection.status || 'inactive'"
        @select="handleSelectConnection"
        @contextmenu="handleConnectionRightClick"
      />

      <g v-if="connectionStore.draggingConnection" class="dragging-line">
        <path
          :d="draggingPathData"
          stroke="oklch(0.6 0.02 50)"
          stroke-width="2"
          stroke-dasharray="5,5"
          fill="none"
        />
      </g>
    </svg>

    <ConnectionSettingsPopover
      v-if="showSettings && connectionStore.selectedConnection"
      :connection="connectionStore.selectedConnection"
      :position="settingsPosition"
      @close="handleCloseSettings"
    />
  </div>
</template>
