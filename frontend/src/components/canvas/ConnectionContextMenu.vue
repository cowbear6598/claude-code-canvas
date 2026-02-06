<script setup lang="ts">
import type { TriggerMode } from '@/types/connection'
import { Zap, Brain } from 'lucide-vue-next'
import { useConnectionStore } from '@/stores/connectionStore'
import { useToast } from '@/composables/useToast'

interface Props {
  position: { x: number; y: number }
  connectionId: string
  currentTriggerMode: TriggerMode
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  'trigger-mode-changed': []
}>()

const connectionStore = useConnectionStore()
const { toast } = useToast()

const handleToggleTriggerMode = async (): Promise<void> => {
  const targetMode: TriggerMode = props.currentTriggerMode === 'auto' ? 'ai-decide' : 'auto'

  const result = await connectionStore.updateConnectionTriggerMode(props.connectionId, targetMode)

  if (result) {
    const modeText = targetMode === 'auto' ? '自動觸發' : ' AI 判斷'
    toast({
      title: '觸發模式已變更',
      description: `已切換為${modeText}模式`,
      duration: 2000
    })
    emit('trigger-mode-changed')
    emit('close')
  } else {
    toast({
      title: '變更失敗',
      description: '無法變更觸發模式',
      duration: 3000
    })
  }
}

const handleBackgroundClick = (): void => {
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-40"
    @click="handleBackgroundClick"
  >
    <div
      class="bg-card border border-doodle-ink rounded-md p-1 fixed z-50"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }"
      @click.stop
    >
      <button
        class="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs hover:bg-secondary"
        @click="handleToggleTriggerMode"
      >
        <Zap
          v-if="currentTriggerMode === 'ai-decide'"
          :size="14"
          class="text-foreground"
        />
        <Brain
          v-else
          :size="14"
          class="text-foreground"
        />
        <span class="font-mono text-foreground">
          {{ currentTriggerMode === 'auto' ? '切換為 AI 判斷模式' : '切換為自動觸發模式' }}
        </span>
      </button>
    </div>
  </div>
</template>
