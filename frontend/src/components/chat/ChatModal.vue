<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import type { Pod } from '@/types'
import ChatHeader from './ChatHeader.vue'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import ChatToolPanel from './ChatToolPanel.vue'
import { useChatStore } from '@/stores/chatStore'
import { websocketService } from '@/services/websocket'
import {
  MAX_MESSAGES_COUNT,
  CONTENT_PREVIEW_LENGTH,
  RESPONSE_PREVIEW_LENGTH,
} from '@/lib/constants'

const props = defineProps<{
  pod: Pod
}>()

const emit = defineEmits<{
  close: []
  'update-pod': [pod: Pod]
}>()

const chatStore = useChatStore()

// Use chatStore for messages and typing indicator
const messages = computed(() => chatStore.getMessages(props.pod.id))
const isTyping = computed(() => chatStore.isTyping(props.pod.id))

const handleSend = async (content: string) => {
  if (!content.trim()) return

  // Limit messages count
  const currentMessages = chatStore.getMessages(props.pod.id)
  if (currentMessages.length > MAX_MESSAGES_COUNT) {
    // TODO: Implement message trimming in chatStore if needed
    console.warn('[ChatModal] Message count exceeds limit:', MAX_MESSAGES_COUNT)
  }

  // Send message via chatStore (which uses WebSocket)
  await chatStore.sendMessage(props.pod.id, content)

  // Update Pod output preview with user message
  emit('update-pod', {
    ...props.pod,
    output: [
      ...props.pod.output,
      `> ${content.slice(0, CONTENT_PREVIEW_LENGTH)}${content.length > CONTENT_PREVIEW_LENGTH ? '...' : ''}`,
    ],
  })
}

// Watch for chat completion to update pod output
// Track the last message ID we've processed to avoid duplicates
let lastProcessedMessageId: string | null = null

watch(
  () => messages.value,
  (newMessages) => {
    if (newMessages.length === 0) return

    const lastMessage = newMessages[newMessages.length - 1]

    // Only process assistant messages that are complete (not partial)
    // and haven't been processed yet
    if (
      lastMessage &&
      lastMessage.role === 'assistant' &&
      !lastMessage.isPartial &&
      lastMessage.id !== lastProcessedMessageId
    ) {
      lastProcessedMessageId = lastMessage.id

      // Update Pod output with assistant's response
      emit('update-pod', {
        ...props.pod,
        output: [
          ...props.pod.output,
          lastMessage.content.slice(0, RESPONSE_PREVIEW_LENGTH) +
          (lastMessage.content.length > RESPONSE_PREVIEW_LENGTH ? '...' : ''),
        ],
      })
    }
  },
  { deep: true }
)

const handleClose = () => {
  emit('close')
}

// Join pod room on mount
onMounted(() => {
  console.log('[ChatModal] Joining pod room:', props.pod.id)
  websocketService.podJoin({ podId: props.pod.id })
})

// Leave pod room on unmount
onUnmounted(() => {
  console.log('[ChatModal] Leaving pod room:', props.pod.id)
  websocketService.podLeave({ podId: props.pod.id })
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- 遮罩 -->
    <div class="absolute inset-0 modal-overlay" />

    <!-- 內容 -->
    <div class="relative flex gap-4 max-w-5xl w-full max-h-[85vh]">
      <!-- 主聊天視窗 -->
      <div class="chat-window flex-1 flex flex-col overflow-hidden">
        <ChatHeader :pod="pod" @close="handleClose" />
        <ChatMessages :messages="messages" :is-typing="isTyping" />
        <ChatInput @send="handleSend" />
      </div>

      <!-- 工具面板 -->
      <ChatToolPanel :pod-id="pod.id" />
    </div>
  </div>
</template>
