<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { Message } from '@/types'
import ChatMessageBubble from './ChatMessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'

const props = defineProps<{
  messages: Message[]
  isTyping: boolean
}>()

const messagesEndRef = ref<HTMLDivElement | null>(null)

// Check if there's any partial message
const hasPartialMessage = computed(() => {
  return props.messages.some(msg => msg.isPartial)
})

// 訊息更新時自動滾動到底部
watch(
  () => [props.messages, props.isTyping],
  async () => {
    await nextTick()
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  },
  { deep: true }
)
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    <ChatMessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />

    <!-- 打字指示器 - 僅在沒有 partial 訊息時顯示 -->
    <div v-if="isTyping && !hasPartialMessage" class="flex justify-start">
      <div
        class="p-3 rounded-lg border-2 border-doodle-ink bg-card"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
      >
        <TypingIndicator />
      </div>
    </div>

    <div ref="messagesEndRef" />
  </div>
</template>
