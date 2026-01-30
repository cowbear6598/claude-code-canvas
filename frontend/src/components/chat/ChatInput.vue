<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Send, Mic } from 'lucide-vue-next'
import { MAX_MESSAGE_LENGTH, TEXTAREA_MAX_HEIGHT } from '@/lib/constants'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

const props = defineProps<{
  isTyping?: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')
const editableRef = ref<HTMLDivElement | null>(null)
const isListening = ref(false)
const recognition = ref<SpeechRecognition | null>(null)

const moveCursorToEnd = (): void => {
  if (!editableRef.value) return

  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(editableRef.value)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

const updateText = (text: string): void => {
  const truncated = text.length > MAX_MESSAGE_LENGTH
    ? text.slice(0, MAX_MESSAGE_LENGTH)
    : text

  input.value = truncated
  if (editableRef.value) {
    editableRef.value.innerText = truncated
  }
  moveCursorToEnd()
}

const handleInput = (e: Event): void => {
  const target = e.target as HTMLDivElement
  const text = target.innerText

  if (text.length > MAX_MESSAGE_LENGTH) {
    updateText(text)
  } else {
    input.value = text
  }
}

const handlePaste = (e: ClipboardEvent): void => {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain')
  if (text) {
    document.execCommand('insertText', false, text)
  }
}

const handleSend = (): void => {
  if (props.isTyping) return
  if (!input.value.trim()) return
  if (input.value.length > MAX_MESSAGE_LENGTH) return

  emit('send', input.value)
  input.value = ''
  if (editableRef.value) {
    editableRef.value.innerHTML = ''
  }
}

const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const toggleListening = (): void => {
  if (!recognition.value) return

  if (isListening.value) {
    recognition.value.stop()
    isListening.value = false
  } else {
    recognition.value.start()
    isListening.value = true
    editableRef.value?.focus()
  }
}

const initializeSpeechRecognition = (): void => {
  const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognitionConstructor) {
    recognition.value = null
    return
  }

  recognition.value = new SpeechRecognitionConstructor()
  recognition.value.lang = 'zh-TW'
  recognition.value.interimResults = false
  recognition.value.continuous = true

  recognition.value.onresult = (event: SpeechRecognitionEvent) => {
    const lastResult = event.results[event.results.length - 1]
    const transcript = lastResult[0].transcript
    updateText(input.value + transcript)
  }

  recognition.value.onend = () => {
    isListening.value = false
  }

  recognition.value.onerror = (event: SpeechRecognitionErrorEvent) => {
    isListening.value = false
    console.warn('Speech recognition error:', event.error)
  }
}

const cleanupSpeechRecognition = (): void => {
  if (!recognition.value) return

  recognition.value.stop()
  recognition.value.onresult = null
  recognition.value.onend = null
  recognition.value.onerror = null
}

onMounted(() => {
  initializeSpeechRecognition()
})

onUnmounted(() => {
  cleanupSpeechRecognition()
})
</script>

<template>
  <div class="p-4 border-t-2 border-doodle-ink">
    <div class="flex gap-2">
      <ScrollArea
        class="flex-1 border-2 border-doodle-ink rounded-lg bg-card focus-within:ring-2 focus-within:ring-primary"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)', maxHeight: TEXTAREA_MAX_HEIGHT + 'px' }"
      >
        <div
          ref="editableRef"
          :contenteditable="!isTyping"
          class="px-4 py-3 font-mono text-sm outline-none leading-5 chat-input-editable"
          @input="handleInput"
          @keydown="handleKeyDown"
          @paste="handlePaste"
        />
      </ScrollArea>
      <button
        :disabled="isTyping"
        class="px-4 py-3 bg-doodle-green border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
        @click="handleSend"
      >
        <Send
          :size="20"
          class="text-card"
        />
      </button>
      <button
        class="px-4 py-3 border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        :class="isListening ? 'bg-red-500' : 'bg-doodle-coral'"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
        @click="toggleListening"
      >
        <Mic
          :size="20"
          class="text-card"
          :class="{ 'animate-pulse': isListening }"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-editable:empty::before {
  content: 'Type your message...';
  color: oklch(0.55 0.02 50);
  pointer-events: none;
}
</style>
