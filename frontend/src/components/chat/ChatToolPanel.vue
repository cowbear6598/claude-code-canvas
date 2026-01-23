<script setup lang="ts">
import { computed } from 'vue'
import { tools } from '@/data/tools'
import { useChatStore } from '@/stores/chatStore'
import { Loader2, Check } from 'lucide-vue-next'
import type { ToolUseInfo } from '@/types/chat'

const props = defineProps<{
  podId?: string
}>()

const chatStore = useChatStore()

const activeTools = computed<ToolUseInfo[]>(() => {
  if (!props.podId) return []

  const messages = chatStore.getMessages(props.podId)

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg && msg.toolUse && msg.toolUse.length > 0) {
      return msg.toolUse
    }
  }

  return []
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500'
    case 'running':
      return 'bg-blue-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}
</script>

<template>
  <div class="tool-panel w-48 p-3 flex flex-col gap-2 h-fit">
    <h3 class="font-sans text-lg text-doodle-ink mb-2 text-center">Tools</h3>

    <!-- Active Tools Section -->
    <div v-if="activeTools.length > 0" class="mb-3 p-2 bg-background rounded border-2 border-doodle-ink">
      <p class="text-xs font-mono text-foreground mb-2 font-semibold">Active:</p>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="tool in activeTools"
          :key="tool.toolName"
          class="flex items-center gap-2 p-1.5 rounded bg-card"
        >
          <div :class="['w-2 h-2 rounded-full', getStatusColor(tool.status)]" />
          <component
            :is="tool.status === 'running' ? Loader2 : Check"
            :size="12"
            :class="[
              'flex-shrink-0',
              tool.status === 'running' ? 'animate-spin text-blue-600' : 'text-green-600'
            ]"
          />
          <span class="text-xs font-mono truncate">{{ tool.toolName }}</span>
        </div>
      </div>
    </div>

    <!-- Available Tools -->
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="tool in tools"
        :key="tool.label"
        class="tool-item p-3 flex flex-col items-center gap-1 opacity-50"
      >
        <div
          :class="[
            'w-8 h-8 rounded-full border border-doodle-ink flex items-center justify-center',
            tool.color,
          ]"
        >
          <component :is="tool.icon" :size="16" class="text-card" />
        </div>
        <span class="text-xs font-mono text-foreground">{{ tool.label }}</span>
      </div>
    </div>
  </div>
</template>
