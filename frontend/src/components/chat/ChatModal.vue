<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { Pod } from '@/types'
import type { ContentBlock } from '@/types/websocket/requests'
import ChatHeader from './ChatHeader.vue'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import { useChatStore } from '@/stores/chatStore'

const props = defineProps<{
  pod: Pod
}>()

const emit = defineEmits<{
  close: []
}>()

const chatStore = useChatStore()

const messages = computed(() => chatStore.getMessages(props.pod.id))
const isTyping = computed(() => chatStore.isTyping(props.pod.id))
const isHistoryLoading = computed(() => chatStore.isHistoryLoading(props.pod.id))

const handleSend = async (content: string, contentBlocks?: ContentBlock[]): Promise<void> => {
  if (!content.trim() && !contentBlocks) return

  await chatStore.sendMessage(props.pod.id, content, contentBlocks)
}

const handleClose = (): void => {
  emit('close')
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 modal-overlay" />

    <div class="relative max-w-3xl w-full h-[85vh]">
      <div class="chat-window flex flex-col h-full overflow-hidden">
        <ChatHeader
          :pod="pod"
          @close="handleClose"
        />
        <ChatMessages
          :messages="messages"
          :is-typing="isTyping"
          :is-loading-history="isHistoryLoading"
        />
        <ChatInput
          :is-typing="isTyping"
          @send="handleSend"
        />
      </div>
    </div>
  </div>
</template>
