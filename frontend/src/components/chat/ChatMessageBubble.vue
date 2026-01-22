<script setup lang="ts">
import type { Message } from '@/types'
import { Hammer, Check, Loader2, AlertCircle } from 'lucide-vue-next'

defineProps<{
  message: Message
}>()

const getToolStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return Check
    case 'running':
      return Loader2
    case 'error':
      return AlertCircle
    default:
      return Hammer
  }
}

const getToolStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-green-600'
    case 'running':
      return 'text-blue-600'
    case 'error':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}
</script>

<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[80%] rounded-lg border-2 border-doodle-ink',
        message.role === 'user' ? 'bg-doodle-blue text-card' : 'bg-card text-foreground',
      ]"
      :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
    >
      <!-- Tool Usage Section -->
      <div v-if="message.toolUse && message.toolUse.length > 0" class="border-b-2 border-doodle-ink p-2">
        <div class="flex flex-col gap-1">
          <div
            v-for="tool in message.toolUse"
            :key="tool.toolName"
            class="flex items-center gap-2 text-xs font-mono"
          >
            <component
              :is="getToolStatusIcon(tool.status)"
              :size="14"
              :class="[
                getToolStatusColor(tool.status),
                tool.status === 'running' ? 'animate-spin' : ''
              ]"
            />
            <span class="font-semibold">{{ tool.toolName }}</span>
            <span v-if="tool.status === 'running'" class="text-gray-500">running...</span>
            <span v-else-if="tool.status === 'completed'" class="text-green-600">✓</span>
          </div>
        </div>
      </div>

      <!-- Message Content -->
      <div class="p-3">
        <p class="font-mono text-sm whitespace-pre-wrap">{{ message.content }}</p>
        <!-- Partial message indicator -->
        <span v-if="message.isPartial" class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5" />
      </div>
    </div>
  </div>
</template>
