<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Connection } from '@/types/connection'
import { useConnectionStore } from '@/stores/connectionStore'

const props = defineProps<{
  connection: Connection
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const connectionStore = useConnectionStore()
const popoverRef = ref<HTMLDivElement | null>(null)
const isUpdating = ref(false)

const handleToggleAutoTrigger = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  const newValue = !props.connection.autoTrigger

  try {
    await connectionStore.updateConnectionAutoTrigger(props.connection.id, newValue)
  } catch (error) {
    console.error('[ConnectionSettingsPopover] Failed to update autoTrigger:', error)
  } finally {
    isUpdating.value = false
  }
}

const handleClickOutside = (e: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
  }, 0)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="popoverRef"
    class="connection-settings-popover"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
    }"
  >
    <div class="connection-settings-popover__title">連線設定</div>

    <div class="connection-settings-popover__item">
      <div>
        <div class="connection-settings-popover__label">自動觸發</div>
        <div class="connection-settings-popover__description">
          Source POD 完成回應後自動傳遞
        </div>
      </div>

      <div
        :class="['connection-settings-toggle', { active: connection.autoTrigger }]"
        @click="handleToggleAutoTrigger"
      >
        <div class="connection-settings-toggle__knob" />
      </div>
    </div>
  </div>
</template>
