<script setup lang="ts">
import { ref } from 'vue'
import type { Pod, Message } from '@/types'
import ChatHeader from './ChatHeader.vue'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import ChatToolPanel from './ChatToolPanel.vue'
import {
  MAX_MESSAGES_COUNT,
  CONTENT_PREVIEW_LENGTH,
  RESPONSE_PREVIEW_LENGTH,
  RESPONSE_DELAY_MIN,
  RESPONSE_DELAY_MAX,
} from '@/lib/constants'

const props = defineProps<{
  pod: Pod
}>()

const emit = defineEmits<{
  close: []
  'update-pod': [pod: Pod]
}>()

const messages = ref<Message[]>([
  {
    id: '1',
    role: 'assistant',
    content: `Hi! I'm ${props.pod.name}. How can I help you today?`,
  },
])
const isTyping = ref(false)

const handleSend = async (content: string) => {
  if (!content.trim()) return

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content,
  }

  messages.value.push(userMessage)

  // 限制訊息陣列大小
  if (messages.value.length > MAX_MESSAGES_COUNT) {
    messages.value = messages.value.slice(-MAX_MESSAGES_COUNT)
  }

  isTyping.value = true

  // 模擬 AI 回覆
  setTimeout(() => {
    const responses = [
      "I understand! Let me work on that for you...",
      "Great question! Here's what I think...",
      "Interesting! I'll help you figure this out.",
      "Sure thing! Let me process that request.",
    ]
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)] || '',
    }
    messages.value.push(assistantMessage)
    isTyping.value = false

    // 更新 Pod 輸出
    emit('update-pod', {
      ...props.pod,
      output: [
        ...props.pod.output,
        `> ${content.slice(0, CONTENT_PREVIEW_LENGTH)}...`,
        assistantMessage.content.slice(0, RESPONSE_PREVIEW_LENGTH),
      ],
    })
  }, RESPONSE_DELAY_MIN + Math.random() * (RESPONSE_DELAY_MAX - RESPONSE_DELAY_MIN))
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click="handleClose">
    <!-- 遮罩 -->
    <div class="absolute inset-0 modal-overlay" />

    <!-- 內容 -->
    <div class="relative flex gap-4 max-w-5xl w-full max-h-[85vh]" @click.stop>
      <!-- 主聊天視窗 -->
      <div class="chat-window flex-1 flex flex-col overflow-hidden">
        <ChatHeader :pod="pod" @close="handleClose" />
        <ChatMessages :messages="messages" :is-typing="isTyping" />
        <ChatInput @send="handleSend" />
      </div>

      <!-- 工具面板 -->
      <ChatToolPanel />
    </div>
  </div>
</template>
