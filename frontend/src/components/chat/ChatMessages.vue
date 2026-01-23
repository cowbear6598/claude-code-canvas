<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { Message } from '@/types'
import ChatMessageBubble from './ChatMessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'

const props = withDefaults(
  defineProps<{
    messages: Message[]
    isTyping: boolean
    isLoadingHistory?: boolean
  }>(),
  {
    isLoadingHistory: false
  }
)

const messagesEndRef = ref<HTMLDivElement | null>(null)

/**
 * Check if there's any partial message in the messages array
 */
const hasPartialMessage = computed(() => {
  return props.messages.some(msg => msg.isPartial === true)
})

/**
 * Scroll to bottom of messages container
 * @param smooth - Whether to use smooth scrolling
 */
const scrollToBottom = async (smooth = true): Promise<void> => {
  await nextTick()
  messagesEndRef.value?.scrollIntoView({
    behavior: smooth ? 'smooth' : 'instant',
    block: 'end'
  })
}

onMounted(() => {
  scrollToBottom(false)
})

/**
 * Auto-scroll when messages or typing state changes
 */
watch(
  () => [props.messages.length, props.isTyping] as const,
  () => {
    scrollToBottom(true)
  }
)
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    <!-- 載入歷史訊息中 -->
    <div v-if="isLoadingHistory && messages.length === 0" class="flex justify-center items-center h-full">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <TypingIndicator />
        <span class="text-sm">正在載入對話歷史...</span>
      </div>
    </div>

    <!-- 訊息列表 -->
    <template v-else>
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
    </template>

    <div ref="messagesEndRef" />
  </div>
</template>
