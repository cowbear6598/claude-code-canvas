<script setup lang="ts">
import type { Message } from '@/types'
import { FileText } from 'lucide-vue-next'

defineProps<{
  message: Message
}>()
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
      <!-- Message Content -->
      <div class="p-3">
        <!-- Summary Badge -->
        <div v-if="message.isSummarized" class="message-summary-badge">
          <FileText :size="10" />
          <span>摘要</span>
        </div>

        <p class="font-mono text-sm whitespace-pre-wrap break-all">{{ message.content }}</p>
        <!-- Partial message indicator -->
        <span v-if="message.isPartial" class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5" />
      </div>
    </div>
  </div>
</template>
