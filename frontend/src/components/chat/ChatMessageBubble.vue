<script setup lang="ts">
import type { Message } from '@/types'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[80%] p-3 rounded-lg border-2 border-doodle-ink',
        message.role === 'user' ? 'bg-doodle-blue text-card' : 'bg-card text-foreground',
      ]"
      :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
    >
      <p class="font-mono text-sm">{{ message.content }}</p>
    </div>
  </div>
</template>
