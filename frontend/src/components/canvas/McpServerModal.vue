<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { McpServerConfig } from '@/types'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  initialName?: string
  initialConfig?: McpServerConfig
}

const props = withDefaults(defineProps<Props>(), {
  initialName: undefined,
  initialConfig: undefined,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [payload: { name: string; config: McpServerConfig }]
}>()

const jsonText = ref('')
const errorMessage = ref('')
const jsonPlaceholder = '{"my-mcp-server": {"command": "npx", "args": ["-y", "my-mcp"]}}'

watch(
  () => props.open,
  (newOpen) => {
    if (newOpen) {
      if (props.mode === 'edit' && props.initialName && props.initialConfig) {
        jsonText.value = JSON.stringify({ [props.initialName]: props.initialConfig }, null, 2)
      } else {
        jsonText.value = ''
      }
      errorMessage.value = ''
    }
  }
)

const parseAndValidateJson = (): { name: string; config: McpServerConfig } | null => {
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(jsonText.value) as Record<string, unknown>
  } catch {
    errorMessage.value = 'JSON 格式錯誤，請檢查語法'
    return null
  }

  const keys = Object.keys(parsed)
  if (keys.length === 0) {
    errorMessage.value = '請輸入至少一個 MCP Server 設定'
    return null
  }

  const name = keys[0] as string
  const config = parsed[name] as Record<string, unknown>

  const hasCommand = typeof config.command === 'string'
  const hasTypeAndUrl = typeof config.type === 'string' && typeof config.url === 'string'

  if (!hasCommand && !hasTypeAndUrl) {
    errorMessage.value = '設定必須包含 command 欄位（stdio 模式）或 type + url 欄位（http/sse 模式）'
    return null
  }

  errorMessage.value = ''
  return { name, config: config as unknown as McpServerConfig }
}

const handleSubmit = (): void => {
  const result = parseAndValidateJson()
  if (!result) return

  emit('submit', result)
}

const handleClose = (): void => {
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ mode === 'create' ? '新增 MCP Server' : '編輯 MCP Server' }}</DialogTitle>
        <DialogDescription>
          請貼入 JSON 格式的 MCP Server 設定，第一個 key 為名稱，value 為設定內容
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <textarea
          v-model="jsonText"
          :placeholder="jsonPlaceholder"
          class="w-full h-[300px] p-3 bg-card border-2 border-doodle-ink rounded text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-doodle-ink/50 doodle-textarea"
        />

        <p
          v-if="errorMessage"
          class="text-sm text-red-500 font-mono"
        >
          {{ errorMessage }}
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose"
        >
          取消
        </Button>
        <Button
          variant="default"
          @click="handleSubmit"
        >
          {{ mode === 'create' ? '建立' : '儲存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
