<script setup lang="ts">
import type { TriggerMode } from '@/types/connection'
import { Zap, Brain, ArrowRight } from 'lucide-vue-next'
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

const handleSetTriggerMode = async (targetMode: TriggerMode): Promise<void> => {
  if (targetMode === props.currentTriggerMode) {
    emit('close')
    return
  }

  const result = await connectionStore.updateConnectionTriggerMode(props.connectionId, targetMode)

  if (result) {
    const modeTextMap: Record<TriggerMode, string> = {
      auto: '自動觸發',
      'ai-decide': 'AI 判斷',
      direct: '直接觸發'
    }
    toast({
      title: '觸發模式已變更',
      description: `已切換為${modeTextMap[targetMode]}模式`,
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
      <!-- Auto 模式按鈕 -->
      <button
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs hover:bg-secondary',
          { 'bg-secondary border-l-2 border-l-primary': currentTriggerMode === 'auto' }
        ]"
        @click="handleSetTriggerMode('auto')"
      >
        <Zap
          :size="14"
          :class="currentTriggerMode === 'auto' ? 'text-primary' : 'text-foreground'"
        />
        <span
          :class="[
            'font-mono',
            currentTriggerMode === 'auto' ? 'text-primary font-semibold' : 'text-foreground'
          ]"
        >
          自動觸發 (Auto)
        </span>
      </button>

      <!-- Direct 模式按鈕 -->
      <button
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs hover:bg-secondary',
          { 'bg-secondary border-l-2 border-l-primary': currentTriggerMode === 'direct' }
        ]"
        @click="handleSetTriggerMode('direct')"
      >
        <ArrowRight
          :size="14"
          :class="currentTriggerMode === 'direct' ? 'text-primary' : 'text-foreground'"
        />
        <span
          :class="[
            'font-mono',
            currentTriggerMode === 'direct' ? 'text-primary font-semibold' : 'text-foreground'
          ]"
        >
          直接觸發 (Direct)
        </span>
      </button>

      <!-- AI Decide 模式按鈕 -->
      <button
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs hover:bg-secondary',
          { 'bg-secondary border-l-2 border-l-primary': currentTriggerMode === 'ai-decide' }
        ]"
        @click="handleSetTriggerMode('ai-decide')"
      >
        <Brain
          :size="14"
          :class="currentTriggerMode === 'ai-decide' ? 'text-primary' : 'text-foreground'"
        />
        <span
          :class="[
            'font-mono',
            currentTriggerMode === 'ai-decide' ? 'text-primary font-semibold' : 'text-foreground'
          ]"
        >
          AI 判斷 (AI Decide)
        </span>
      </button>
    </div>
  </div>
</template>
