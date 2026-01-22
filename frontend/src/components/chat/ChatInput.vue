<script setup lang="ts">
import { ref } from 'vue'
import { Send, Mic } from 'lucide-vue-next'
import { MAX_MESSAGE_LENGTH } from '@/lib/constants'

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')

const handleSend = () => {
  if (!input.value.trim()) return
  if (input.value.length > MAX_MESSAGE_LENGTH) return
  emit('send', input.value)
  input.value = ''
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSend()
  }
}
</script>

<template>
  <div class="p-4 border-t-2 border-doodle-ink">
    <div class="flex gap-2">
      <input
        v-model="input"
        type="text"
        placeholder="Type your message..."
        :maxlength="MAX_MESSAGE_LENGTH"
        class="flex-1 px-4 py-3 border-2 border-doodle-ink rounded-lg bg-card font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
        @keydown="handleKeyDown"
      />
      <button
        class="px-4 py-3 bg-doodle-green border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
        @click="handleSend"
      >
        <Send :size="20" class="text-card" />
      </button>
      <button
        class="px-4 py-3 bg-doodle-coral border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
      >
        <Mic :size="20" class="text-card" />
      </button>
    </div>
  </div>
</template>
