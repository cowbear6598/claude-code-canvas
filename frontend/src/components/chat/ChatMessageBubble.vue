<script setup lang="ts">
import { computed } from 'vue'
import { FileText } from 'lucide-vue-next'
import type { Message } from '@/types'

const props = defineProps<{
  message: Message
}>()

const messageAlignment = computed(() =>
  props.message.role === 'user' ? 'justify-end' : 'justify-start'
)

const bubbleStyle = computed(() =>
  props.message.role === 'user'
    ? 'bg-doodle-blue text-card'
    : 'bg-card text-foreground'
)
</script>

<template>
  <div :class="['flex', messageAlignment]">
    <div
      :class="['max-w-[80%] rounded-lg border-2 border-doodle-ink', bubbleStyle]"
      :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
    >
      <div class="p-3">
        <div v-if="message.isSummarized" class="message-summary-badge">
          <FileText :size="10" />
          <span>摘要</span>
        </div>

        <p class="font-mono text-sm whitespace-pre-wrap break-all">
          {{ message.content }}
        </p>

        <span
          v-if="message.isPartial"
          class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5"
        />
      </div>
    </div>
  </div>
</template>
