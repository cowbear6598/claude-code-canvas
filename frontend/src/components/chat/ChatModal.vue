<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import type { Pod } from '@/types'
import ChatHeader from './ChatHeader.vue'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import ChatToolPanel from './ChatToolPanel.vue'
import { useChatStore } from '@/stores/chatStore'
import { websocketService } from '@/services/websocket'
import {
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

const messages = computed(() => chatStore.getMessages(props.pod.id))
const isTyping = computed(() => chatStore.isTyping(props.pod.id))
const isHistoryLoading = computed(() => chatStore.isHistoryLoading(props.pod.id))

const lastProcessedMessageId = ref<string | null>(null)

const truncateContent = (content: string, maxLength: number): string => {
  return content.length > maxLength
    ? `${content.slice(0, maxLength)}...`
    : content
}

const handleSend = async (content: string): Promise<void> => {
  if (!content.trim()) return

  try {
    await chatStore.sendMessage(props.pod.id, content)

    emit('update-pod', {
      ...props.pod,
      output: [
        ...props.pod.output,
        `> ${truncateContent(content, CONTENT_PREVIEW_LENGTH)}`,
      ],
    })
  } catch (error) {
    console.error('[ChatModal] Failed to send message:', error)
  }
}

const handleClose = (): void => {
  emit('close')
}

watch(
  messages,
  (newMessages) => {
    if (newMessages.length === 0) return

    const lastMessage = newMessages[newMessages.length - 1]

    // Only process completed assistant messages that haven't been processed yet
    if (
      lastMessage &&
      lastMessage.role === 'assistant' &&
      !lastMessage.isPartial &&
      lastMessage.id !== lastProcessedMessageId.value
    ) {
      lastProcessedMessageId.value = lastMessage.id

      // Update Pod output with assistant's response
      emit('update-pod', {
        ...props.pod,
        output: [
          ...props.pod.output,
          truncateContent(lastMessage.content, RESPONSE_PREVIEW_LENGTH),
        ],
      })
    }
  },
  { deep: true }
)

onMounted(() => {
  websocketService.podJoin({ podId: props.pod.id })
})

onUnmounted(() => {
  websocketService.podLeave({ podId: props.pod.id })
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 modal-overlay" />

    <div class="relative flex gap-4 max-w-5xl w-full max-h-[85vh]">
      <div class="chat-window flex-1 flex flex-col overflow-hidden">
        <ChatHeader :pod="pod" @close="handleClose" />
        <ChatMessages :messages="messages" :is-typing="isTyping" :is-loading-history="isHistoryLoading" />
        <ChatInput @send="handleSend" />
      </div>

      <ChatToolPanel :pod-id="pod.id" />
    </div>
  </div>
</template>
