<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Loader2, Check } from 'lucide-vue-next'
import type { MessageRole, ToolUseInfo } from '@/types/chat'

const props = defineProps<{
  content: string
  role: MessageRole
  isPartial?: boolean
  toolUse?: ToolUseInfo[]
  isSummarized?: boolean
}>()

const messageAlignment = computed(() =>
  props.role === 'user' ? 'justify-end' : 'justify-start'
)

const bubbleStyle = computed(() =>
  props.role === 'user'
    ? 'bg-doodle-blue text-card'
    : 'bg-card text-foreground'
)

const hasToolUse = computed(() => props.toolUse && props.toolUse.length > 0)
</script>

<template>
  <div :class="['flex', messageAlignment]">
    <div
      :class="['max-w-[80%] rounded-lg border-2 border-doodle-ink', bubbleStyle]"
      :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
    >
      <div class="p-3">
        <div
          v-if="hasToolUse"
          class="mb-2 flex flex-wrap gap-1.5"
        >
          <div
            v-for="tool in toolUse"
            :key="tool.toolUseId"
            :class="[
              'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border',
              tool.status === 'running'
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-600'
                : 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-600'
            ]"
          >
            <component
              :is="tool.status === 'running' ? Loader2 : Check"
              :size="12"
              :class="[
                'flex-shrink-0',
                tool.status === 'running' ? 'animate-spin' : ''
              ]"
            />
            <span>{{ tool.toolName }}</span>
          </div>
        </div>

        <div
          v-if="isSummarized"
          class="message-summary-badge"
        >
          <FileText :size="10" />
          <span>摘要</span>
        </div>

        <p class="font-mono text-sm whitespace-pre-wrap break-all">
          {{ content }}
        </p>

        <span
          v-if="isPartial"
          class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5"
        />
      </div>
    </div>
  </div>
</template>
