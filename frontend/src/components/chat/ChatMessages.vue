<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import type { Message } from '@/types'
import ChatMessageBubble from './ChatMessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  <ScrollArea class="flex-1 p-4">
    <div class="space-y-4">
      <!-- 載入歷史訊息中 -->
      <div
        v-if="isLoadingHistory && messages.length === 0"
        class="flex justify-center items-center h-full"
      >
        <div class="flex flex-col items-center gap-3 text-muted-foreground">
          <TypingIndicator />
          <span class="text-sm">正在載入對話歷史...</span>
        </div>
      </div>

      <!-- 訊息列表 -->
      <template v-else>
        <template
          v-for="message in messages"
          :key="message.id"
        >
          <!-- 使用者訊息：直接渲染 -->
          <ChatMessageBubble
            v-if="message.role === 'user'"
            :content="message.content"
            :role="message.role"
            :is-partial="message.isPartial"
            :is-summarized="message.isSummarized"
          />

          <!-- Assistant 訊息：渲染 subMessages -->
          <template v-else-if="message.role === 'assistant'">
            <!-- 如果有 subMessages，逐個渲染 -->
            <template v-if="message.subMessages && message.subMessages.length > 0">
              <ChatMessageBubble
                v-for="sub in message.subMessages"
                :key="sub.id"
                :content="sub.content"
                :role="message.role"
                :is-partial="sub.isPartial"
                :tool-use="sub.toolUse"
                :is-summarized="message.isSummarized"
              />
            </template>

            <!-- Fallback: 直接渲染整個 message -->
            <ChatMessageBubble
              v-else
              :content="message.content"
              :role="message.role"
              :is-partial="message.isPartial"
              :tool-use="message.toolUse"
              :is-summarized="message.isSummarized"
            />
          </template>
        </template>

        <!-- 打字指示器 - Claude 回應中顯示 -->
        <div
          v-if="isTyping"
          class="flex justify-start"
        >
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
  </ScrollArea>
</template>
